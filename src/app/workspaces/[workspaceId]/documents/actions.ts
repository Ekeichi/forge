"use server"

import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { Prisma } from "@prisma/client";
import { chunkDocument } from "./[documentId]/actions";

export async function addDocument(workspaceId: string, title: string) {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) {
        redirect("/sign-in");
    }

    const membership = await prisma.workspaceMembership.findUnique({
        where: {
            userId_workspaceId: {
                userId: session.user.id,
                workspaceId: workspaceId
            }
        },
    });

    if (!membership || !["OWNER", "ADMIN", "MEMBER"].includes(membership.role)) {
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
                ownerId: session.user.id
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
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) {
        redirect("/sign-in");
    }

    const membership = await prisma.workspaceMembership.findUnique({
        where: {
            userId_workspaceId: {
                userId: session.user.id,
                workspaceId: formData.get("workspaceId") as string
            }
        },
    });

    if (!membership || !["OWNER", "ADMIN", "MEMBER"].includes(membership.role)) {
        return { error: "Vous n'avez pas les droits pour sauvegarder le document." };
    }

    const documentId = formData.get("documentId") as string;

    await prisma.document.update({
        where: { id: documentId },
        data: {
            title: formData.get("title") as string,
            content: formData.get("content") as string,
        }
    });

    await chunkDocument(documentId);

    revalidatePath(`/workspaces/${formData.get("workspaceId")}/documents`);
    return { success: true };
}

export async function deleteDocument(documentId: string, workspaceId: string) {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) {
        redirect("/sign-in");
    }

    const membership = await prisma.workspaceMembership.findUnique({
        where: {
            userId_workspaceId: {
                userId: session.user.id,
                workspaceId: workspaceId
            }
        },
    });

    if (!membership || !["OWNER", "ADMIN"].includes(membership.role)) {
        return { error: "Vous n'avez pas les droits pour supprimer ce document." };
    }

    await prisma.document.delete({
        where: {
            id: documentId
        }
    });

    revalidatePath(`/workspaces/${workspaceId}/documents`);
    return { success: true };
}