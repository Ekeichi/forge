"use server";

import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

export async function updateMemberRole(formData: FormData) {
    const userId = formData.get("userId") as string;
    const workspaceId = formData.get("workspaceId") as string;
    const role = formData.get("role") as string;

    if (!workspaceId || !userId || !role) {
        return { error: "Données manquantes" };
    }

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
        return { error: "Vous n'avez pas les droits pour modifier les roles." };
    }

    if (!["OWNER", "ADMIN", "MEMBER"].includes(role)) {
        return { error: "Vous ne pouvez pas assigner ce rôle." };
    }

    if (role === "OWNER" && membership.role !== "OWNER") {
        return { error: "Seul un propriétaire peut nommer un autre propriétaire." };
    }

    if (userId === session.user.id) {
        return { error: "Vous ne pouvez pas modifier votre propre rôle." };
    }

    const targetMembership = await prisma.workspaceMembership.findUnique({
        where: {
            userId_workspaceId: {
                userId: userId,
                workspaceId: workspaceId
            }
        },
    });

    if (!targetMembership) {
        return { error: "Cette personne n'est pas membre du workspace." };
    }

    if (targetMembership.role === "OWNER") {
        return { error: "Vous ne pouvez pas modifier le rôle du propriétaire." };
    }

    await prisma.workspaceMembership.update({
        where: {
            userId_workspaceId: {
                userId: userId,
                workspaceId: workspaceId
            }
        },
        data: {
            role: role as "OWNER" | "ADMIN" | "MEMBER"
        }
    });

    revalidatePath(`/workspaces/${workspaceId}`);

    return { success: true };

}