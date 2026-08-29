"use server";

import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";

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
