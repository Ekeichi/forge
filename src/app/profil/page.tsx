import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { createWorkspace } from "./actions";
import { SignOutButton } from "@/components/sign-out-button";
import { AcceptInvitationButton } from "@/components/acceptInvitationButton";
import { RefuseInvitationButton } from "@/components/refuseInvitationButton";

export default async function ProfilePage() {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) redirect("/sign-in");

    const memberships = await prisma.workspaceMembership.findMany({
        where: { userId: session.user.id },
        include: { workspace: true },
    });

    const invitations = await prisma.workspaceInvitation.findMany({
        where: { email: session.user.email, status: "PENDING" },
        include: { workspace: true },
    });

    return (
        <main style={{ padding: 32 }}>
            <h1>Mon profil</h1>
            <p>Nom : {session.user.name}</p>
            <p>Email : {session.user.email}</p>

            <h1>Mes workspaces</h1>
            <form action={createWorkspace}>
                <input name="name" placeholder="Nom du workspace" required />
                <button type="submit">Créer</button>
            </form>
            <ul>
                {memberships.map((m) => (
                    <li key={`${m.userId}-${m.workspaceId}`}>
                        <Link href={`/workspaces/${m.workspaceId}`}>{m.workspace.name} — {m.role}</Link>
                    </li>
                ))}
            </ul>

            <h1>Invitations</h1>
            <ul>
                {invitations.map((inv) => (
                    <li key={inv.id}>
                        Invitation pour <strong>{inv.workspace.name}</strong> — <AcceptInvitationButton invId={inv.id} /> <RefuseInvitationButton invId={inv.id} />
                    </li>
                ))}
            </ul>

            <SignOutButton />
        </main>
    );
}