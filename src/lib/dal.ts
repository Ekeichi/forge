import { cache } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import type { Role } from "@/generated/prisma/enums";

/**
 * Data Access Layer : point de passage unique pour l'authentification et
 * l'autorisation. Toute lecture ou écriture portant sur un workspace doit
 * passer par `getMembership` / `requireMembership` — une Server Action est un
 * endpoint HTTP public, le `workspaceId` reçu n'est jamais digne de confiance.
 *
 * Ne jamais importer ce module depuis un composant client.
 */

/** Du moins au plus privilégié. Un rôle donne les droits de tous ceux du dessous. */
const ROLE_RANK: Record<Role, number> = {
    MEMBER: 0,
    ADMIN: 1,
    OWNER: 2,
};

export class AuthorizationError extends Error {
    constructor(message = "Accès refusé.") {
        super(message);
        this.name = "AuthorizationError";
    }
}

/**
 * Session courante, ou redirection vers la connexion.
 * `cache` mémoïse l'appel sur la durée de la requête : pages et actions
 * peuvent l'appeler librement sans multiplier les lectures de session.
 */
export const verifySession = cache(async () => {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) {
        redirect("/sign-in");
    }
    return { userId: session.user.id, email: session.user.email };
});

/**
 * Appartenance de l'utilisateur courant au workspace, ou `null`.
 * Renvoyer `null` plutôt que de lever permet à l'appelant de choisir sa
 * réponse : `notFound()` sur une page, message d'erreur dans une action.
 */
export const getMembership = cache(async (workspaceId: string) => {
    const { userId } = await verifySession();
    if (!workspaceId) return null;

    return prisma.workspaceMembership.findUnique({
        where: { userId_workspaceId: { userId, workspaceId } },
        select: { userId: true, workspaceId: true, role: true },
    });
});

/** L'utilisateur courant a-t-il au moins ce rôle sur le workspace ? */
export async function hasRole(workspaceId: string, minRole: Role = "MEMBER") {
    const membership = await getMembership(workspaceId);
    return membership !== null && ROLE_RANK[membership.role] >= ROLE_RANK[minRole];
}

/**
 * Exige l'appartenance au workspace et lève sinon. À utiliser là où il n'y a
 * pas d'interface pour afficher une erreur.
 */
export async function requireMembership(workspaceId: string, minRole: Role = "MEMBER") {
    const membership = await getMembership(workspaceId);
    if (!membership || ROLE_RANK[membership.role] < ROLE_RANK[minRole]) {
        throw new AuthorizationError();
    }
    return membership;
}
