"use server";

import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { getMembership, verifySession } from "@/lib/dal";

export async function updateMemberRole(formData: FormData) {
    const userId = formData.get("userId") as string;
    const workspaceId = formData.get("workspaceId") as string;
    const role = formData.get("role") as string;

    if (!workspaceId || !userId || !role) {
        return { error: "Données manquantes" };
    }

    const { userId: callerId } = await verifySession();
    const membership = await getMembership(workspaceId);

    if (!membership || !["OWNER", "ADMIN"].includes(membership.role)) {
        return { error: "Vous n'avez pas les droits pour modifier les roles." };
    }

    if (!["OWNER", "ADMIN", "MEMBER"].includes(role)) {
        return { error: "Vous ne pouvez pas assigner ce rôle." };
    }

    if (role === "OWNER" && membership.role !== "OWNER") {
        return { error: "Seul un propriétaire peut nommer un autre propriétaire." };
    }

    if (userId === callerId) {
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

/**
 * Retire une personne du workspace. L'appartenance etant verifiee a chaque
 * requete par la DAL, la revocation prend effet immediatement — y compris pour
 * une session deja ouverte.
 */
export async function removeMember(formData: FormData) {
    const userId = formData.get("userId") as string;
    const workspaceId = formData.get("workspaceId") as string;

    if (!workspaceId || !userId) {
        return { error: "Données manquantes" };
    }

    const { userId: callerId } = await verifySession();
    const membership = await getMembership(workspaceId);

    if (!membership || !["OWNER", "ADMIN"].includes(membership.role)) {
        return { error: "Vous n'avez pas les droits pour retirer un membre." };
    }

    if (userId === callerId) {
        return { error: "Vous ne pouvez pas vous retirer vous-même du workspace." };
    }

    const targetMembership = await prisma.workspaceMembership.findUnique({
        where: { userId_workspaceId: { userId, workspaceId } },
    });

    if (!targetMembership) {
        return { error: "Cette personne n'est pas membre du workspace." };
    }

    if (targetMembership.role === "OWNER") {
        return { error: "Vous ne pouvez pas retirer le propriétaire du workspace." };
    }

    await prisma.$transaction(async (tx) => {
        await tx.workspaceMembership.delete({
            where: { userId_workspaceId: { userId, workspaceId } },
        });

        // Sans cela, une invitation deja acceptee resterait exploitable pour
        // revenir dans le workspace apres exclusion.
        const user = await tx.user.findUnique({
            where: { id: userId },
            select: { email: true },
        });
        if (user) {
            await tx.workspaceInvitation.deleteMany({
                where: { workspaceId, email: user.email },
            });
        }
    });

    revalidatePath(`/workspaces/${workspaceId}`);

    return { success: true };
}
