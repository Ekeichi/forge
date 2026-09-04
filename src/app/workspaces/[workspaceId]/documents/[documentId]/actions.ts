import prisma from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import { pipeline } from "@xenova/transformers";

let embedder: any = null;

export async function getEmbedder() {
    if (!embedder) {
        embedder = await pipeline("feature-extraction", "Xenova/all-MiniLM-L6-v2");
    }
    return embedder;
}

export async function embedChunk(chunk: string): Promise<number[]> {
    const pipe = await getEmbedder();
    const output = await pipe(chunk, { pooling: "mean", normalize: true });
    return Array.from(output.data);
}


export async function chunkDocument(documentId: string) {
    console.log("chunkDocument called for", documentId);
    const document = await prisma.document.findUnique({
        where: { id: documentId },
    });

    if (!document) {
        return { error: "Document non trouvé" };
    }

    const chunks = (document.content ?? "")
        .replace(/\r\n/g, "\n")
        .split("\n")
        .map((c) => c.trim())
        .filter((c) => c.length > 0);

    if (chunks.length === 0) {
        return { error: "Aucun contenu à découper" };
    }

    try {
        await prisma.chunk.deleteMany({ where: { documentId: document.id } });

        const embeddings = await Promise.all(chunks.map((chunk) => embedChunk(chunk)));

        await prisma.chunk.createMany({
            data: chunks.map((chunk, i) => ({
                documentId: document.id,
                title: `${document.title} - chunk ${i + 1}`,
                content: chunk,
            })),
        });

        const createdChunks = await prisma.chunk.findMany({
            where: { documentId: document.id },
            select: { id: true, title: true },
            orderBy: { title: "asc" },
        });
        for (let i = 0; i < chunks.length; i++) {
            const title = `${document.title} - chunk ${i + 1}`;
            const created = createdChunks.find(c => c.title === title);
            console.log("chunk match:", title, "->", created?.id);
            if (!created) continue;

            const vectorStr = `[${embeddings[i].join(",")}]`;
            console.log("vectorStr length:", embeddings[i].length);
            await prisma.$executeRaw`
            UPDATE "Chunk"
            SET embedding = ${Prisma.raw(`'${vectorStr}'::vector`)}
            WHERE id = ${created.id}
        `;
        }

        return { success: true, count: chunks.length };
    } catch (error) {
        console.error("chunkDocument error:", error);
        return { error: "Échec de l'insertion des chunks" };
    }
}
