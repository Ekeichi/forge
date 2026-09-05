"use server";

import { searchChunks } from "@/lib/rag";
import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
});

const SYSTEM_PROMPT = `Tu es Forge, un assistant personnel. Réponds de manière concise et claire. Pas de smiley, donne la réponse rapidement et directement.

Règle pour utiliser l'outil search_documents :
- Si tu connais la réponse (culture générale, faits connus) → réponds directement SANS utiliser l'outil.
- Si tu ne connais pas le terme ou le sujet (nom technique, produit spécifique, entité inconnue) → utilise IMMÉDIATEMENT search_documents sans demander la permission. Ne demande JAMAIS à l'utilisateur s'il veut que tu cherches.`;

const tools: Anthropic.Tool[] = [{
    name: "search_documents",
    description: "Recherche dans les documents du workspace les passages pertinents. À utiliser SEULEMENT si la question porte explicitement sur le contenu des documents importés par l'utilisateur. Ne pas utiliser pour des questions de culture générale ou des faits connus.",
    input_schema: {
        type: "object",
        properties: {
            query: {
                type: "string",
                description: "La question ou les mots-clés à rechercher"
            }
        },
        required: ["query"]
    }
}];

export async function askForge(query: string, workspaceId: string): Promise<string> {
    const messages: Anthropic.MessageParam[] = [
        { role: "user", content: query }
    ];

    // Premier appel : Claude décide s'il doit chercher dans les docs
    const completion = await anthropic.messages.create({
        model: "claude-haiku-4-5",
        max_tokens: 2048,
        system: SYSTEM_PROMPT,
        messages,
        tools,
    });

    if (completion.stop_reason === "tool_use") {
        console.log("tool_use");
        const toolCall = completion.content.find(b => b.type === "tool_use") as Anthropic.ToolUseBlock;
        const claudeQuery = (toolCall.input as { query: string }).query ?? query;

        // Exécution du tool
        const results = await searchChunks(claudeQuery, workspaceId) as { id: string; title: string; content: string }[];
        const context = results.map(r => r.content).join("\n\n");

        // On renvoie le résultat du tool à Claude dans la même conversation
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

        const textBlock = finalCompletion.content.find(b => b.type === "text") as Anthropic.TextBlock | undefined;
        return textBlock?.text ?? "";
    } else {
        const textBlock = completion.content.find(b => b.type === "text") as Anthropic.TextBlock | undefined;
        return textBlock?.text ?? "";
    }
}

