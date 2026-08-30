import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { inviteMember } from "@/app/profil/actions";

export default async function WorkspacePage({ params }: { params: Promise<{ workspaceId: string }> }) {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) redirect("/sign-in");

    const { workspaceId } = await params;

    const workspace = await prisma.workspace.findFirst({
        where: {
            id: workspaceId,
            memberships: {
                some: { userId: session.user.id }
            }
        },
        include: { memberships: { include: { user: true } } },
    });

    if (!workspace) {
        notFound();
    }

    return (
        <main style={{ padding: 32 }}>
            <h1>{workspace.name}</h1>
            <ul>
                {workspace.memberships.map((m) => (
                    <li key={`${m.userId}-${m.workspaceId}`}>
                        {m.user.name} — {m.role}
                    </li>
                ))}
            </ul>
            <h1>Inviter des membres</h1>
            <form action={async (formData) => {
                "use server";
                await inviteMember(formData);
            }}>
                <input type="hidden" name="workspaceId" value={workspace.id} />
                <input name="email" type="email" placeholder="Email" required />
                <button type="submit">Inviter</button>
            </form>
            <Link href="/profil">Retour au profil</Link>
        </main>
    );
}