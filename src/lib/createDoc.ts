"use server"

import prisma from "@/lib/prisma";
import { chunkDocument } from "@/app/workspaces/[workspaceId]/documents/[documentId]/actions";

export async function createDocument(title: string, content: string, workspaceId: string, userId: string) {
    const doc = await prisma.document.create({
        data: {
            title: title,
            content: content,
            workspaceId,
            ownerId: userId,
        },
    });

    await chunkDocument(doc.id);
}
