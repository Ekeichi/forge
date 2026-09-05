import prisma from "@/lib/prisma";

/**
 * Garde-fous sur la boucle agent : chaque appel coute un appel API facture.
 * Deux niveaux complementaires :
 *  - une fenetre glissante par utilisateur, en memoire, contre les rafales ;
 *  - un plafond journalier par workspace, en base, contre l'epuisement du budget.
 */

const num = (value: string | undefined, fallback: number) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const BURST_WINDOW_MS = num(process.env.AGENT_BURST_WINDOW_S, 60) * 1000;
const BURST_MAX = num(process.env.AGENT_BURST_MAX, 10);
const DAILY_WORKSPACE_MAX = num(process.env.AGENT_DAILY_WORKSPACE_MAX, 200);

export type QuotaDecision =
    | { allowed: true }
    | { allowed: false; message: string };

/**
 * Horodatages des appels recents, par utilisateur.
 * En memoire, donc par instance : c'est un garde-fou anti-rafale, pas une
 * limite globale. A basculer sur un store partage (Redis) des qu'il y a
 * plus d'une instance.
 */
const recentCalls = new Map<string, number[]>();

function withinBurstLimit(userId: string, now: number) {
    const cutoff = now - BURST_WINDOW_MS;
    const calls = (recentCalls.get(userId) ?? []).filter((t) => t > cutoff);

    if (calls.length >= BURST_MAX) {
        recentCalls.set(userId, calls);
        return false;
    }

    calls.push(now);
    recentCalls.set(userId, calls);

    // Purge opportuniste : sans elle la map croit avec le nombre d'utilisateurs.
    if (recentCalls.size > 10_000) {
        for (const [key, timestamps] of recentCalls) {
            if (timestamps.every((t) => t <= cutoff)) recentCalls.delete(key);
        }
    }
    return true;
}

/** Reinitialise l'etat en memoire. Reserve aux tests. */
export function resetBurstLimiter() {
    recentCalls.clear();
}

export async function checkAgentQuota(userId: string, workspaceId: string): Promise<QuotaDecision> {
    if (!withinBurstLimit(userId, Date.now())) {
        return {
            allowed: false,
            message: "Trop de requêtes coup sur coup. Patientez une minute avant de réessayer.",
        };
    }

    const since = new Date();
    since.setHours(0, 0, 0, 0);

    const usedToday = await prisma.agentRun.count({
        where: { workspaceId, createdAt: { gte: since } },
    });

    if (usedToday >= DAILY_WORKSPACE_MAX) {
        return {
            allowed: false,
            message: `Cet espace a atteint sa limite de ${DAILY_WORKSPACE_MAX} requêtes pour aujourd'hui.`,
        };
    }

    return { allowed: true };
}
