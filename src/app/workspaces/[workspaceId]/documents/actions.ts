"use server"

import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

async function addDocument(workspaceId: string, title: string) {
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

    await prisma.document.create({
        data: {
            workspaceId: workspaceId,
            title: title,
            ownerId: session.user.id
        }
    });

    revalidatePath(`/workspaces/${workspaceId}/documents`);
    return { success: true };
}