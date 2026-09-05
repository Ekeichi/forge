"use server";

import { searchChunks } from "@/lib/rag";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import Anthropic from "@anthropic-ai/sdk";
import { headers } from "next/headers";

const anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
});

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
}];

export async function askForge(query: string, workspaceId: string): Promise<string> {
    const session = await auth.api.getSession({ headers: await headers() });
    const userId = session?.user?.id ?? "anonymous";

    const startMs = performance.now();
    const messages: Anthropic.MessageParam[] = [
        { role: "user", content: query }
    ];

    let inputTokens = 0;
    let outputTokens = 0;
    let toolCalled = false;
    let toolName: string | undefined;
    let toolQuery: string | undefined;
    let resultCount: number | undefined;
    let topScore: number | undefined;
    let averageScore: number | undefined;
    let output = "";

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
        const toolCall = completion.content.find(b => b.type === "tool_use") as Anthropic.ToolUseBlock;
        const claudeQuery = (toolCall.input as { query: string }).query ?? query;

        toolCalled = true;
        toolName = toolCall.name;
        toolQuery = claudeQuery;

        const results = await searchChunks(claudeQuery, workspaceId);
        const context = results.map(r => r.content).join("\n\n");

        resultCount = results.length;
        if (results.length > 0) {
            const scores = results.map(r => r.score);
            topScore = Math.max(...scores);
            averageScore = scores.reduce((a, b) => a + b, 0) / scores.length;
        }

        const finalCompletion = await anthropic.messages.create({
            model: "claude-haiku-4-5",
            max_tokens: 2048,
            system: SYSTEM_PROMPT,
            tools,
            messages: [
                ...messages,
                { role: "assistant", content: completion.content },
                {
                    role: "user",
                    content: [{
                        type: "tool_result",
                        tool_use_id: toolCall.id,
                        content: context || "Aucun document pertinent trouvé.",
                    }]
                }
            ],
        });

        inputTokens += finalCompletion.usage.input_tokens;
        outputTokens += finalCompletion.usage.output_tokens;

        const textBlock = finalCompletion.content.find(b => b.type === "text") as Anthropic.TextBlock | undefined;
        output = textBlock?.text ?? "";
    } else {
        const textBlock = completion.content.find(b => b.type === "text") as Anthropic.TextBlock | undefined;
        output = textBlock?.text ?? "";
    }

    const latencyMs = Math.round(performance.now() - startMs);

    prisma.agentRun.create({
        data: {
            workspaceId,
            userId,
            input: query,
            output,
            toolCalled,
            toolName,
            toolQuery,
            resultCount,
            topScore,
            averageScore,
            latencyMs,
            inputTokens,
            outputTokens,
        },
    }).catch(err => console.error("[AgentRun] Failed to save:", err));

    return output;
}
