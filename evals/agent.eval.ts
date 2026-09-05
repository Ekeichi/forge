import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import prisma from '@/lib/prisma';
import { runAgent, type AgentMetrics } from '@/lib/agent';
import { searchChunks } from '@/lib/rag';
import { createDocument } from '@/lib/createDoc';
import { EVAL_CASES, FIXTURE_DOCUMENTS, type EvalCase, type ExpectedTool } from './dataset';

// Tarifs claude-haiku-4-5, en dollars par million de tokens.
const PRICE_INPUT_PER_MTOK = 1;
const PRICE_OUTPUT_PER_MTOK = 5;

const EVAL_USER_ID = 'eval-user';
const RETRIEVAL_TOP_K = 5;

// Seuils qui font échouer la campagne : à relever au fur et à mesure que
// le prompt et les descriptions d'outils s'améliorent.
const MIN_ROUTING_ACCURACY = 0.8;
const MIN_RECALL_AT_5 = 0.9;

type CaseResult = {
    testCase: EvalCase;
    output: string;
    metrics: AgentMetrics;
    actualTool: ExpectedTool;
    routingOk: boolean;
    answerOk: boolean | null;
};

let workspaceId: string;
const results = new Map<string, CaseResult>();
const retrievalHits = new Map<string, boolean>();

/** Le premier outil pertinent appelé, ramené au vocabulaire du dataset. */
function actualToolOf(metrics: AgentMetrics): ExpectedTool {
    if (!metrics.toolNames) return 'none';
    const names = metrics.toolNames.split(', ');
    if (names.includes('search_documents')) return 'search_documents';
    if (names.includes('create_document')) return 'create_document';
    return 'none';
}

function containsAll(haystack: string, needles: string[]) {
    const lower = haystack.toLowerCase();
    return needles.every(n => lower.includes(n.toLowerCase()));
}

function costOf(m: AgentMetrics) {
    return (m.inputTokens * PRICE_INPUT_PER_MTOK + m.outputTokens * PRICE_OUTPUT_PER_MTOK) / 1_000_000;
}

function percentile(values: number[], p: number) {
    if (values.length === 0) return 0;
    const sorted = [...values].sort((a, b) => a - b);
    return sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * p) - 1)];
}

beforeAll(async () => {
    if (!process.env.ANTHROPIC_API_KEY) {
        throw new Error('ANTHROPIC_API_KEY manquant : les évals appellent la vraie API.');
    }

    await prisma.user.upsert({
        where: { id: EVAL_USER_ID },
        update: {},
        create: { id: EVAL_USER_ID, email: 'eval@forge.local', name: 'Eval' },
    });

    const workspace = await prisma.workspace.create({
        data: {
            name: `eval-${Date.now()}`,
            memberships: { create: { userId: EVAL_USER_ID, role: 'OWNER' } },
        },
    });
    workspaceId = workspace.id;

    // Indexation des fixtures (embeddings compris).
    for (const doc of FIXTURE_DOCUMENTS) {
        await createDocument(doc.title, doc.lines.join('\n'), workspaceId, EVAL_USER_ID);
    }

    // Retrieval : mesuré isolément, pour distinguer un échec de recherche
    // d'un échec de raisonnement du modèle.
    for (const testCase of EVAL_CASES) {
        if (!testCase.expectedChunk) continue;
        const found = await searchChunks(testCase.question, workspaceId);
        retrievalHits.set(
            testCase.id,
            found.slice(0, RETRIEVAL_TOP_K).some(chunk => chunk.content === testCase.expectedChunk),
        );
    }

    // Boucle agent : séquentiel, pour ne pas se faire limiter par l'API.
    for (const testCase of EVAL_CASES) {
        const { output, metrics } = await runAgent(testCase.question, workspaceId, EVAL_USER_ID);
        const actualTool = actualToolOf(metrics);
        results.set(testCase.id, {
            testCase,
            output,
            metrics,
            actualTool,
            routingOk: actualTool === testCase.expectedTool,
            answerOk: testCase.expectedAnswerContains
                ? containsAll(output, testCase.expectedAnswerContains)
                : null,
        });
    }
});

afterAll(async () => {
    if (workspaceId) {
        // WorkspaceMembership n'est pas en ON DELETE CASCADE : on le purge d'abord.
        // Un échec de nettoyage doit se voir, pas laisser des workspaces orphelins.
        try {
            await prisma.workspaceMembership.deleteMany({ where: { workspaceId } });
            await prisma.workspace.delete({ where: { id: workspaceId } });
        } catch (err) {
            console.error(`[eval] Nettoyage du workspace ${workspaceId} échoué :`, err);
        }
    }

    const all = [...results.values()];
    if (all.length === 0) return;

    const latencies = all.map(r => r.metrics.latencyMs);
    const totalCost = all.reduce((acc, r) => acc + costOf(r.metrics), 0);
    const graded = all.filter(r => r.answerOk !== null);
    const retrieval = [...retrievalHits.values()];

    const pct = (n: number, d: number) => (d === 0 ? '—' : `${Math.round((n / d) * 100)} %`);

    console.log('\n─── Éval boucle agent ───────────────────────────────');
    console.table(all.map(r => ({
        cas: r.testCase.id,
        attendu: r.testCase.expectedTool,
        obtenu: r.actualTool,
        routage: r.routingOk ? 'ok' : 'ÉCHEC',
        réponse: r.answerOk === null ? '—' : r.answerOk ? 'ok' : 'ÉCHEC',
        tours: r.metrics.iterations,
        fin: r.metrics.stopReason,
        ms: r.metrics.latencyMs,
        tokens: r.metrics.inputTokens + r.metrics.outputTokens,
    })));
    console.log(`Routage correct   : ${pct(all.filter(r => r.routingOk).length, all.length)} (${all.length} cas)`);
    console.log(`Recall@${RETRIEVAL_TOP_K}         : ${pct(retrieval.filter(Boolean).length, retrieval.length)} (${retrieval.length} cas)`);
    console.log(`Réponses correctes: ${pct(graded.filter(r => r.answerOk).length, graded.length)} (${graded.length} cas notés)`);
    console.log(`Runs en succès    : ${pct(all.filter(r => r.metrics.success).length, all.length)}`);
    console.log(`Erreurs outil     : ${all.reduce((a, r) => a + r.metrics.toolErrors, 0)}`);
    console.log(`Latence méd./p95  : ${percentile(latencies, 0.5)} ms / ${percentile(latencies, 0.95)} ms`);
    console.log(`Coût campagne     : $${totalCost.toFixed(4)} (~$${(totalCost / all.length).toFixed(5)} / requête)`);
    console.log('─────────────────────────────────────────────────────\n');
});

describe('Routage des outils', () => {
    it.each(EVAL_CASES)('[$id] $expectedTool', ({ id }) => {
        const result = results.get(id)!;
        expect(result.actualTool, `réponse : ${result.output.slice(0, 120)}`).toBe(result.testCase.expectedTool);
    });

    it(`précision globale >= ${MIN_ROUTING_ACCURACY * 100} %`, () => {
        const all = [...results.values()];
        const accuracy = all.filter(r => r.routingOk).length / all.length;
        expect(accuracy).toBeGreaterThanOrEqual(MIN_ROUTING_ACCURACY);
    });
});

describe(`Retrieval (recall@${RETRIEVAL_TOP_K})`, () => {
    const withChunk = EVAL_CASES.filter(c => c.expectedChunk);

    it.each(withChunk)('[$id] le chunk attendu est dans le top-5', ({ id }) => {
        expect(retrievalHits.get(id)).toBe(true);
    });

    it(`recall global >= ${MIN_RECALL_AT_5 * 100} %`, () => {
        const hits = [...retrievalHits.values()];
        expect(hits.filter(Boolean).length / hits.length).toBeGreaterThanOrEqual(MIN_RECALL_AT_5);
    });
});

describe('Qualité des réponses', () => {
    const graded = EVAL_CASES.filter(c => c.expectedAnswerContains);

    it.each(graded)('[$id] la réponse contient les éléments attendus', ({ id }) => {
        const result = results.get(id)!;
        expect(result.output.toLowerCase(), `réponse : ${result.output.slice(0, 200)}`)
            .toSatisfy((out: string) => result.testCase.expectedAnswerContains!.every(n => out.includes(n.toLowerCase())));
    });
});

describe('Santé de la boucle', () => {
    it('aucun run ne sature MAX_ITERATIONS', () => {
        const stuck = [...results.values()].filter(r => r.metrics.stopReason === 'max_iterations');
        expect(stuck.map(r => r.testCase.id)).toEqual([]);
    });

    it('aucune erreur d\'exécution d\'outil', () => {
        const failing = [...results.values()].filter(r => r.metrics.toolErrors > 0);
        expect(failing.map(r => r.testCase.id)).toEqual([]);
    });
});
