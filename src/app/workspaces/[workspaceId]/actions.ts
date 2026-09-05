"use server";

import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { headers } from "next/headers";
import { after } from "next/server";
import { runAgent } from "@/lib/agent";

export async function askForge(query: string, workspaceId: string): Promise<string> {
    const session = await auth.api.getSession({ headers: await headers() });
    const userId = session?.user?.id ?? "anonymous";

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
