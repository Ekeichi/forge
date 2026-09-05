import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { inviteMember } from "@/app/profil/actions";
import { removeMember, updateMemberRole } from "../actions";
import RagChat from "./RagChat";

const roleStyles: Record<string, string> = {
    OWNER: "bg-gray-900 text-white dark:bg-gray-100 dark:text-gray-900",
    ADMIN: "bg-gray-200 text-gray-800 dark:bg-gray-700 dark:text-gray-100",
    MEMBER: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300",
};

function initials(label: string) {
    return label
        .split(/[\s@.]+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0]?.toUpperCase() ?? "")
        .join("");
}

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

    const currentUserRole = workspace.memberships.find(m => m.userId === session.user.id)?.role;
    const canAdminister = currentUserRole === "ADMIN" || currentUserRole === "OWNER";

    return (
        <main className="min-h-screen bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 py-12 px-6">
            <div className="max-w-5xl mx-auto space-y-12">

                {/* En-tête */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-gray-100 dark:border-gray-800 pb-6 gap-4">
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight">{workspace.name}</h1>
                        <p className="text-gray-500 dark:text-gray-400 mt-1 text-sm flex items-center gap-2">
                            <span>
                                {workspace.memberships.length} membre{workspace.memberships.length !== 1 ? "s" : ""}
                            </span>
                            {currentUserRole && (
                                <>
                                    <span aria-hidden="true">·</span>
                                    <span>votre rôle&nbsp;: {currentUserRole}</span>
                                </>
                            )}
                        </p>
                    </div>
                    <div className="flex items-center gap-4">
                        <Link
                            href={`/workspaces/${workspaceId}/analytics`}
                            className="text-sm font-medium text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 transition-colors"
                        >
                            Analytics →
                        </Link>
                        <Link href="/profil" className="text-sm font-medium text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 transition-colors">
                            ← Retour au profil
                        </Link>
                    </div>
                </div>

                {canAdminister && (
                    <>
                        {/* Poser une question aux documents */}
                        <section className="bg-gray-50/50 dark:bg-gray-900/50 p-6 rounded-xl border border-gray-100 dark:border-gray-800">
                            <h2 className="text-lg font-semibold mb-1">Interroger vos documents</h2>
                            <p className="text-sm text-gray-500 dark:text-gray-400 mb-5">
                                Les réponses s&apos;appuient uniquement sur les documents de cet espace.
                            </p>
                            <RagChat workspaceId={workspaceId} />
                        </section>

                        {/* Accès aux documents */}
                        <Link
                            href={`/workspaces/${workspace.id}/documents`}
                            className="group flex items-center justify-between gap-4 bg-gray-50/50 dark:bg-gray-900/50 p-6 rounded-xl border border-gray-100 dark:border-gray-800 hover:border-gray-300 dark:hover:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-900 transition-colors"
                        >
                            <div>
                                <h2 className="text-lg font-semibold mb-1">Documents</h2>
                                <p className="text-sm text-gray-500 dark:text-gray-400">
                                    Consultez, ajoutez et découpez les documents de cet espace.
                                </p>
                            </div>
                            <span
                                aria-hidden="true"
                                className="text-gray-400 dark:text-gray-500 group-hover:text-gray-900 dark:group-hover:text-gray-100 group-hover:translate-x-0.5 transition-all"
                            >
                                →
                            </span>
                        </Link>
                    </>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
                    {/* Liste des membres */}
                    <section className="bg-gray-50/50 dark:bg-gray-900/50 p-6 rounded-xl border border-gray-100 dark:border-gray-800">
                        <h2 className="text-lg font-semibold mb-1">Membres ({workspace.memberships.length})</h2>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mb-5">Les personnes de cet espace.</p>

                        <div className="border border-gray-200 dark:border-gray-800 rounded-lg overflow-hidden bg-white dark:bg-gray-950">
                            <ul className="divide-y divide-gray-100 dark:divide-gray-800">
                                {workspace.memberships.map((m) => {
                                    const label = m.user.name || m.user.email;
                                    return (
                                        <li key={`${m.userId}-${m.workspaceId}`} className="flex items-center justify-between gap-3 p-4 hover:bg-gray-50 dark:hover:bg-gray-900 transition-colors">
                                            <div className="flex items-center gap-3 min-w-0">
                                                <span className="shrink-0 h-8 w-8 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 text-xs font-semibold flex items-center justify-center">
                                                    {initials(label)}
                                                </span>
                                                <div className="min-w-0">
                                                    <p className="font-medium text-sm truncate">{label}</p>
                                                    {m.user.name && (
                                                        <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{m.user.email}</p>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-3 shrink-0">
                                                <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${roleStyles[m.role] ?? roleStyles.MEMBER}`}>
                                                    {m.role}
                                                </span>
                                                {canAdminister && m.role !== "OWNER" && m.userId !== session.user.id && (
                                                    <form action={async (formData) => {
                                                        "use server";
                                                        await removeMember(formData);
                                                    }}>
                                                        <input type="hidden" name="workspaceId" value={workspace.id} />
                                                        <input type="hidden" name="userId" value={m.userId} />
                                                        <button
                                                            type="submit"
                                                            className="text-xs text-gray-400 dark:text-gray-500 hover:text-red-600 dark:hover:text-red-400 transition-colors"
                                                        >
                                                            Retirer
                                                        </button>
                                                    </form>
                                                )}
                                            </div>
                                        </li>
                                    );
                                })}
                            </ul>
                        </div>
                    </section>

                    {/* Panneau d'administration */}
                    {canAdminister && (
                        <div className="space-y-8">

                            {/* Inviter un membre */}
                            <section className="bg-gray-50/50 dark:bg-gray-900/50 p-6 rounded-xl border border-gray-100 dark:border-gray-800">
                                <h2 className="text-lg font-semibold mb-1">Inviter un membre</h2>
                                <p className="text-sm text-gray-500 dark:text-gray-400 mb-5">Ajoutez quelqu&apos;un à cet espace.</p>

                                <form action={async (formData) => {
                                    "use server";
                                    await inviteMember(formData);
                                }} className="flex flex-col gap-3">
                                    <input type="hidden" name="workspaceId" value={workspace.id} />
                                    <input
                                        type="email"
                                        name="email"
                                        placeholder="email@exemple.com"
                                        required
                                        className="px-3 py-2 bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-700 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/10 dark:focus:ring-gray-100/10 focus:border-gray-400 dark:focus:border-gray-500 transition-all placeholder:text-gray-400 dark:placeholder:text-gray-500"
                                    />
                                    <button
                                        type="submit"
                                        className="bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 text-sm font-medium py-2 px-4 rounded-md hover:bg-gray-800 dark:hover:bg-gray-200 transition-colors shadow-sm"
                                    >
                                        Envoyer l&apos;invitation
                                    </button>
                                </form>
                            </section>

                            {/* Modifier les rôles */}
                            <section className="bg-gray-50/50 dark:bg-gray-900/50 p-6 rounded-xl border border-gray-100 dark:border-gray-800">
                                <h2 className="text-lg font-semibold mb-1">Gérer les rôles</h2>
                                <p className="text-sm text-gray-500 dark:text-gray-400 mb-5">Modifiez les autorisations d&apos;un membre.</p>

                                <form action={async (formData) => {
                                    "use server";
                                    await updateMemberRole(formData);
                                }} className="flex flex-col gap-3">
                                    <input type="hidden" name="workspaceId" value={workspace.id} />
                                    <select
                                        name="userId"
                                        className="px-3 py-2 bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-700 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/10 dark:focus:ring-gray-100/10 focus:border-gray-400 dark:focus:border-gray-500 transition-all text-gray-900 dark:text-gray-100"
                                    >
                                        {workspace.memberships.map((m) => (
                                            <option key={`${m.userId}-${m.workspaceId}`} value={m.userId}>
                                                {m.user.name || m.user.email}
                                            </option>
                                        ))}
                                    </select>
                                    <select
                                        name="role"
                                        className="px-3 py-2 bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-700 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/10 dark:focus:ring-gray-100/10 focus:border-gray-400 dark:focus:border-gray-500 transition-all text-gray-900 dark:text-gray-100"
                                    >
                                        {currentUserRole === "OWNER" && <option value="OWNER">OWNER</option>}
                                        <option value="ADMIN">ADMIN</option>
                                        <option value="MEMBER">MEMBER</option>
                                    </select>
                                    <button
                                        type="submit"
                                        className="bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 text-sm font-medium py-2 px-4 rounded-md hover:bg-gray-50 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-gray-100 transition-colors shadow-sm"
                                    >
                                        Appliquer le changement
                                    </button>
                                </form>
                            </section>
                        </div>
                    )}
                </div>
            </div>
        </main>
    );
}
