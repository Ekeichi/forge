import prisma from "@/lib/prisma";
import { getEmbedder } from "@/app/workspaces/[workspaceId]/documents/[documentId]/actions";
import { Prisma } from "@/generated/prisma/client";
import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
});


export async function rag(query: string, workspaceId: string) {
    const pipe = await getEmbedder();

    const output = await pipe(query, { pooling: "mean", normalize: true });
    const vector: number[] = Array.from(output.data);

    const vectorStr = `[${vector.join(",")}]`;
    const results = await prisma.$queryRaw`
        SELECT c.id, c.title, c.content 
        FROM "Chunk" c
        JOIN "Document" d ON c."documentId" = d.id
        WHERE d."workspaceId" = ${workspaceId}
        AND c.embedding IS NOT NULL
        ORDER BY c.embedding <-> ${Prisma.raw(`'${vectorStr}'::vector`)} 
        LIMIT 3
    `;

    const context = (results as any[]).map(r => r.content).join("\n\n");

    const systemPrompt = `Tu dois répondre aux questions des utilisateurs en utilisant UNIQUEMENT le contexte fourni.
    Si la réponse ne se trouve pas dans le contexte, dis "Je n'ai pas cette information."
    Ne fabrique rien.
    
    Contexte fourni :
    ${context}
    `;

    const completion = await anthropic.messages.create({
        model: "claude-haiku-4-5",
        max_tokens: 2048,
        system: systemPrompt,
        messages: [{ role: "user", content: query }],
    });

    // content peut contenir des blocs `thinking` avant le texte : on cherche le bloc,
    // on ne suppose pas que c'est le premier.
    const textBlock = completion.content.find((b) => b.type === "text");
    return textBlock?.type === "text" ? textBlock.text : "";
}
