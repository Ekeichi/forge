import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { inviteMember } from "@/app/profil/actions";
import { updateMemberRole } from "../actions";

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

    return (
        <main className="min-h-screen bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 py-12 px-6">
            <div className="max-w-5xl mx-auto space-y-12">

                {/* En-tête */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-gray-100 dark:border-gray-800 pb-6 gap-4">
                    <h1 className="text-3xl font-bold tracking-tight">{workspace.name}</h1>
                    <Link href="/profil" className="text-sm font-medium text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 transition-colors">
                        ← Retour au profil
                    </Link>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
                    {/* Liste des membres */}
                    <section className="bg-gray-50/50 dark:bg-gray-900/50 p-6 rounded-xl border border-gray-100 dark:border-gray-800">
                        <h2 className="text-lg font-semibold mb-1">Membres ({workspace.memberships.length})</h2>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mb-5">Les personnes de cet espace.</p>

                        <div className="border border-gray-200 dark:border-gray-800 rounded-lg overflow-hidden bg-white dark:bg-gray-950">
                            <ul className="divide-y divide-gray-100 dark:divide-gray-800">
                                {workspace.memberships.map((m) => (
                                    <li key={`${m.userId}-${m.workspaceId}`} className="flex items-center justify-between p-4 hover:bg-gray-50 dark:hover:bg-gray-900 transition-colors">
                                        <span className="font-medium text-sm">{m.user.name || m.user.email}</span>
                                        <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300">
                                            {m.role}
                                        </span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </section>

                    {/* Panneau d'administration */}
                    {(currentUserRole === "ADMIN" || currentUserRole === "OWNER") && (
                        <div className="space-y-8">
                            
                            {/* Inviter un membre */}
                            <section className="bg-gray-50/50 dark:bg-gray-900/50 p-6 rounded-xl border border-gray-100 dark:border-gray-800">
                                <h2 className="text-lg font-semibold mb-1">Inviter un membre</h2>
                                <p className="text-sm text-gray-500 dark:text-gray-400 mb-5">Ajoutez quelqu'un à cet espace.</p>
                                
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