import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createWorkspace } from "./actions";
import { SignOutButton } from "@/components/sign-out-button";

export default async function WorkspacesPage() {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) redirect("/sign-in");

    const memberships = await prisma.workspaceMembership.findMany({
        where: { userId: session.user.id },
        include: { workspace: true },
    });

    return (
        <main style={{ padding: 32 }}>
            <h1>Mes workspaces</h1>
            <form action={createWorkspace}>
                <input name="name" placeholder="Nom du workspace" required />
                <button type="submit">Créer</button>
            </form>
            <ul>
                {memberships.map((m) => (
                    <li key={`${m.userId}-${m.workspaceId}`}>
                        {m.workspace.name} — {m.role}
                    </li>
                ))}
            </ul>
            <SignOutButton />
        </main>
    );
}