"use server";

import prisma from "@/lib/prisma";
import { after } from "next/server";
import { runAgent } from "@/lib/agent";
import { getMembership, verifySession } from "@/lib/dal";
import { checkAgentQuota } from "@/lib/quota";

export async function askForge(query: string, workspaceId: string): Promise<string> {
    // Une Server Action est un endpoint public : le workspaceId vient du client
    // et doit être autorisé avant que l'agent ne touche aux documents.
    const { userId } = await verifySession();

    const membership = await getMembership(workspaceId);
    if (!membership) {
        return "Vous n'avez pas accès à cet espace de travail.";
    }

    // Chaque appel coute un appel API facture : on borne avant d'entrer dans la boucle.
    const quota = await checkAgentQuota(userId, workspaceId);
    if (!quota.allowed) {
        return quota.message;
    }

    const { output, metrics } = await runAgent(query, workspaceId, userId);

    // after() garantit l'ecriture meme si la reponse est deja renvoyee
    // (sans lui, le create non attendu peut etre coupe en serverless).
    after(async () => {
        try {
            await prisma.agentRun.create({
                data: {
                    workspaceId,
                    userId,
                    input: query,
                    output,
                    ...metrics,
                },
            });
        } catch (err) {
            console.error("[AgentRun] Failed to save:", err);
        }
    });

    return output;
}
