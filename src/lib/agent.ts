import Anthropic from "@anthropic-ai/sdk";
import { searchChunks } from "@/lib/rag";
import { createDocument } from "@/lib/createDoc";

const anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
});

export const MAX_ITERATIONS = 3;

const SYSTEM_PROMPT = `Tu es Forge, un assistant personnel. Réponds de manière concise, claire et directe. Pas de smileys.

## Knowledge base

Le workspace de l'utilisateur contient des documents privés accessibles via l'outil search_documents.

Utilise search_documents lorsque la réponse peut dépendre des documents du workspace, notamment pour :
- des informations propres à l'entreprise, au projet ou à l'équipe ;
- des procédures, règles ou politiques internes ;
- des personnes, clients, produits ou projets spécifiques au workspace ;
- du contenu que l'utilisateur a probablement importé dans Forge ;
- toute question demandant explicitement de retrouver ou vérifier une information dans les documents.

N'utilise pas search_documents pour :
- les connaissances générales ;
- les mathématiques simples ;
- les faits universels ou largement connus ;
- les demandes qui ne nécessitent manifestement pas les documents du workspace.

Si tu utilises search_documents :
1. Formule une requête de recherche précise et autonome.
2. Utilise les résultats retournés comme contexte factuel.
3. Ne présente pas une information trouvée dans les documents comme une connaissance générale.
4. Si les résultats ne permettent pas de répondre, indique-le clairement au lieu d'inventer.

Ne demande jamais à l'utilisateur la permission d'utiliser search_documents.`;

const tools: Anthropic.Tool[] = [{
    name: "search_documents",
    description: `
        Recherche dans la base de connaissances privée du workspace.

        Utilise cet outil lorsque la question concerne potentiellement :
        - les informations internes de l'entreprise ;
        - les projets, produits, clients ou équipes ;
        - les procédures et politiques internes ;
        - le contenu des documents importés dans Forge ;
        - une information spécifique que tu dois retrouver ou vérifier.

        N'utilise pas cet outil pour les connaissances générales ou les faits largement connus.

        La recherche est sémantique. Fournis une requête décrivant précisément l'information recherchée.
        `,
    input_schema: {
        type: "object",
        properties: {
            query: {
                type: "string",
                description: `
                    Requête sémantique décrivant précisément l'information recherchée.
                    Inclure le contexte important de la demande.
                    Ne pas simplement recopier la question de l'utilisateur si elle manque de contexte.
                    `
            }
        },
        required: ["query"]
    }
},
{
    name: "create_document",
    description: "Crée un document dans le workspace.",
    input_schema: {
        type: "object",
        properties: {
            title: {
                type: "string",
                description: "Le titre du document."
            },
            content: {
                type: "string",
                description: "Le contenu du document."
            }
        },
        required: ["title", "content"]
    }
}];

/** Tout ce que l'on mesure sur un run, indépendamment de son stockage. */
export type AgentMetrics = {
    toolCalled: boolean;
    toolNames?: string;
    toolQuery?: string;
    resultCount?: number;
    topScore?: number;
    averageScore?: number;
    docCreated: boolean;
    iterations: number;
    stopReason: string;
    toolErrors: number;
    success: boolean;
    latencyMs: number;
    inputTokens: number;
    outputTokens: number;
};

export type AgentResult = { output: string; metrics: AgentMetrics };

/**
 * Boucle agent générique. Volontairement dépourvue de toute dépendance au
 * contexte de requête (session, headers, `after`) pour pouvoir être appelée
 * depuis un harnais d'éval hors runtime Next.
 */
export async function runAgent(query: string, workspaceId: string, userId: string): Promise<AgentResult> {
    const startMs = performance.now();
    const messages: Anthropic.MessageParam[] = [
        { role: "user", content: query }
    ];

    let inputTokens = 0;
    let outputTokens = 0;
    let toolCalled = false;
    const toolNamesSet = new Set<string>();
    let toolQuery: string | undefined;
    let resultCount: number | undefined;
    let topScore: number | undefined;
    let averageScore: number | undefined;
    let docCreated = false;
    let output = "";

    // metriques de boucle
    let iterations = 0;
    let stopReason = "max_iterations";
    let toolErrors = 0;

    try {
        for (let i = 0; i < MAX_ITERATIONS; i++) {
            iterations++;

            const completion = await anthropic.messages.create({
                model: "claude-haiku-4-5",
                max_tokens: 2048,
                system: SYSTEM_PROMPT,
                messages,
                tools,
            });

            inputTokens += completion.usage.input_tokens;
            outputTokens += completion.usage.output_tokens;

            if (completion.stop_reason === "tool_use") {
                messages.push({ role: "assistant", content: completion.content });

                const toolCalls = completion.content.filter(b => b.type === "tool_use") as Anthropic.ToolUseBlock[];
                const toolResults: Anthropic.ToolResultBlockParam[] = [];

                for (const toolCall of toolCalls) {
                    toolCalled = true;
                    toolNamesSet.add(toolCall.name);

                    try {
                        switch (toolCall.name) {
                            case "search_documents": {
                                const claudeQuery = (toolCall.input as { query: string }).query ?? query;
                                toolQuery = claudeQuery;

                                const results = await searchChunks(claudeQuery, workspaceId);
                                const context = results.map(r => r.content).join("\n\n");

                                resultCount = results.length;
                                if (results.length > 0) {
                                    const scores = results.map(r => r.score);
                                    // score = similarite cosinus : plus haut = plus pertinent
                                    topScore = Math.max(...scores);
                                    averageScore = scores.reduce((a, b) => a + b, 0) / scores.length;
                                }

                                toolResults.push({
                                    type: "tool_result",
                                    tool_use_id: toolCall.id,
                                    content: context || "Aucun document pertinent trouvé.",
                                });
                                break;
                            }

                            case "create_document": {
                                const { title, content } = toolCall.input as { title: string, content: string };

                                await createDocument(title, content, workspaceId, userId);
                                docCreated = true;

                                toolResults.push({
                                    type: "tool_result",
                                    tool_use_id: toolCall.id,
                                    content: `Document "${title}" créé avec succès.`,
                                });
                                break;
                            }

                            default:
                                toolErrors++;
                                toolResults.push({
                                    type: "tool_result",
                                    tool_use_id: toolCall.id,
                                    content: `Outil inconnu : ${toolCall.name}`,
                                    is_error: true,
                                });
                        }
                    } catch (err) {
                        // Un outil qui échoue ne doit pas faire tomber la boucle :
                        // on renvoie l'erreur au modèle pour qu'il puisse réagir.
                        console.error(`[askForge] Tool ${toolCall.name} failed:`, err);
                        toolErrors++;
                        toolResults.push({
                            type: "tool_result",
                            tool_use_id: toolCall.id,
                            content: `Erreur lors de l'exécution de ${toolCall.name}.`,
                            is_error: true,
                        });
                    }
                }

                messages.push({ role: "user", content: toolResults });
                continue;
            }

            // Tout stop_reason autre que tool_use termine la boucle.
            const textBlock = completion.content.find(b => b.type === "text") as Anthropic.TextBlock | undefined;
            output = textBlock?.text ?? "";
            stopReason = completion.stop_reason ?? "unknown";
            break;
        }
    } catch (err) {
        console.error("[askForge] Loop failed:", err);
        stopReason = "error";
    }

    if (stopReason === "max_iterations") {
        output = "Je n'ai pas réussi à aboutir sur cette demande. Reformulez-la ou découpez-la.";
    } else if (stopReason === "error") {
        output = "Une erreur est survenue pendant le traitement de votre demande.";
    }

    const latencyMs = Math.round(performance.now() - startMs);
    const success = stopReason === "end_turn" && output.length > 0;

    return {
        output,
        metrics: {
            toolCalled,
            toolNames: toolNamesSet.size > 0 ? [...toolNamesSet].join(", ") : undefined,
            toolQuery,
            resultCount,
            topScore,
            averageScore,
            docCreated,
            iterations,
            stopReason,
            toolErrors,
            success,
            latencyMs,
            inputTokens,
            outputTokens,
        },
    };
}
