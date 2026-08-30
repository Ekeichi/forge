"use server";

import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { z } from "zod";

export async function createWorkspace(formData: FormData) {
    const name = formData.get("name") as string;
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) throw new Error("Non authentifié.");
    const userId = session.user.id;

    await prisma.$transaction(async (tx) => {
        const workspace = await tx.workspace.create({
            data: {
                name,
            },
        });

        await tx.workspaceMembership.create({
            data: {
                userId,
                workspaceId: workspace.id,
                role: "OWNER",
            },
        });
    });

    revalidatePath("/workspace");
}

export async function getWorkspaces() {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) throw new Error("Non authentifié.");
    const userId = session.user.id;
    const memberships = await prisma.workspaceMembership.findMany({
        where: { userId },
        include: { workspace: true },
        orderBy: { createdAt: "desc" },
    });
    return memberships;
}


const inviteSchema = z.object({
    email: z.string().email().toLowerCase(),
    workspaceId: z.string().min(1),
});

export async function inviteMember(formData: FormData) {
    const parsed = inviteSchema.safeParse({
        email: formData.get("email"),
        workspaceId: formData.get("workspaceId"),
    });

    if (!parsed.success) {
        return { error: "Email ou workspace invalide" };
    }

    const { email, workspaceId } = parsed.data;

    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) {
        return { error: "Non authentifié" };
    }

    const membership = await prisma.workspaceMembership.findUnique({
        where: {
            userId_workspaceId: {
                userId: session.user.id,
                workspaceId,
            },
        },
    });

    if (!membership || !["OWNER", "ADMIN"].includes(membership.role)) {
        return { error: "Vous n'avez pas les droits pour inviter sur ce workspace" };
    }

    const existingUser = await prisma.user.findUnique({ where: { email } });

    if (existingUser) {
        const alreadyMember = await prisma.workspaceMembership.findUnique({
            where: {
                userId_workspaceId: {
                    userId: existingUser.id,
                    workspaceId,
                },
            },
        });
        if (alreadyMember) {
            return { error: "Cette personne est déjà membre du workspace" };
        }
    }

    const invitation = await prisma.workspaceInvitation.create({
        data: {
            email,
            workspaceId,
            inviterId: session.user.id,
            status: "PENDING",
        }
    });

    revalidatePath(`/workspaces/${workspaceId}`);

    return { success: true };
}

export async function AcceptInvitation({ invId }: { invId: string }) {

    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) {
        return { error: "Non authentifié" };
    }

    const invitation = await prisma.workspaceInvitation.findUnique({
        where: { id: invId },
        include: { workspace: true },
    });

    if (!invitation || invitation.email !== session.user.email) {
        return { error: "Invitation invalide ou expirée" };
    }

    if (invitation.status === "ACCEPTED") {
        return { error: "Invitation déjà acceptée" };
    }

    await prisma.workspaceMembership.create({
        data: {
            userId: session.user.id,
            workspaceId: invitation.workspaceId,
            role: "MEMBER",
        },
    });

    await prisma.workspaceInvitation.update({
        where: { id: invId },
        data: { status: "ACCEPTED" },
    });

    revalidatePath("/profil");
    revalidatePath(`/workspaces/${invitation.workspaceId}`);

    return { success: true };
}


export async function refuseInvitation({ invId }: { invId: string }) {

    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) {
        return { error: "Non authentifié" };
    }

    const invitation = await prisma.workspaceInvitation.findUnique({
        where: { id: invId },
        include: { workspace: true },
    });

    if (!invitation || invitation.email !== session.user.email) {
        return { error: "Invitation invalide ou expirée" };
    }

    if (invitation.status === "ACCEPTED") {
        return { error: "Invitation déjà acceptée" };
    }

    await prisma.workspaceInvitation.update({
        where: { id: invId },
        data: { status: "REFUSED" },
    });

    revalidatePath("/profil");
    revalidatePath(`/workspaces/${invitation.workspaceId}`);

    return { success: true };
}

