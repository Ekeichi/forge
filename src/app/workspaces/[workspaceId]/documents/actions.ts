"use server"

import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { Prisma } from "@/generated/prisma/client";
import { hasRole, verifySession } from "@/lib/dal";
import { chunkDocument } from "./[documentId]/actions";

export async function addDocument(workspaceId: string, title: string) {
    const { userId } = await verifySession();

    if (!(await hasRole(workspaceId, "MEMBER"))) {
        return { error: "Vous n'avez pas les droits pour ajouter un document." };
    }

    if (!title) {
        return { error: "Le titre du document est requis." };
    }

    try {
        await prisma.document.create({
            data: {
                workspaceId: workspaceId,
                title: title,
                ownerId: userId
            }
        });
    } catch (e) {
        if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
            return { error: "Un document avec ce titre existe déjà dans cet espace." };
        }
        throw e;
    }

    revalidatePath(`/workspaces/${workspaceId}/documents`);
    return { success: true };
}

export async function saveContent(formData: FormData) {
    const workspaceId = formData.get("workspaceId") as string;
    const documentId = formData.get("documentId") as string;

    if (!(await hasRole(workspaceId, "MEMBER"))) {
        return { error: "Vous n'avez pas les droits pour sauvegarder le document." };
    }

    // Le documentId vient du client : la mise a jour est bornee au workspace
    // sur lequel les droits viennent d'etre verifies. Sans ce filtre, un membre
    // d'un workspace pourrait ecraser n'importe quel document de la base.
    let updated;
    try {
        updated = await prisma.document.updateMany({
            where: { id: documentId, workspaceId },
            data: {
                title: formData.get("title") as string,
                content: formData.get("content") as string,
            }
        });
    } catch (e) {
        if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
            return { error: "Un document avec ce titre existe déjà dans cet espace." };
        }
        throw e;
    }

    if (updated.count === 0) {
        return { error: "Document introuvable dans cet espace." };
    }

    await chunkDocument(documentId);

    revalidatePath(`/workspaces/${workspaceId}/documents`);
    return { success: true };
}

export async function deleteDocument(documentId: string, workspaceId: string) {
    if (!(await hasRole(workspaceId, "ADMIN"))) {
        return { error: "Vous n'avez pas les droits pour supprimer ce document." };
    }

    // Meme raisonnement que saveContent : la suppression est bornee au workspace.
    const deleted = await prisma.document.deleteMany({
        where: { id: documentId, workspaceId },
    });

    if (deleted.count === 0) {
        return { error: "Document introuvable dans cet espace." };
    }

    revalidatePath(`/workspaces/${workspaceId}/documents`);
    return { success: true };
}
