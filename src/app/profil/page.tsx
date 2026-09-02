import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { createWorkspace } from "./actions";
import { SignOutButton } from "@/components/sign-out-button";
import { AcceptInvitationButton } from "@/components/acceptInvitationButton";
import { RefuseInvitationButton } from "@/components/refuseInvitationButton";
import { ThemeToggle } from "@/components/theme-toggle";

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
        <main className="min-h-screen bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 py-12 px-6">
            <div className="max-w-3xl mx-auto space-y-12">
                
                {/* En-tête Profil */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-gray-100 dark:border-gray-800 pb-6 gap-4 relative">
                    <div className="absolute top-0 right-0 sm:hidden">
                        <ThemeToggle />
                    </div>
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight">Mon profil</h1>
                        <p className="text-gray-500 dark:text-gray-400 mt-1">{session.user.name || "Sans nom"} ({session.user.email})</p>
                    </div>
                    <div className="flex items-center gap-4">
                        <div className="hidden sm:block"><ThemeToggle /></div>
                        <SignOutButton />
                    </div>
                </div>

                {/* Invitations (Affiché seulement s'il y en a) */}
                {invitations.length > 0 && (
                    <section>
                        <h2 className="text-xl font-semibold mb-4">Invitations en attente</h2>
                        <div className="border border-yellow-200 dark:border-yellow-900/50 bg-yellow-50/50 dark:bg-yellow-950/20 rounded-lg overflow-hidden">
                            <ul className="divide-y divide-yellow-100 dark:divide-yellow-900/50">
                                {invitations.map((inv) => (
                                    <li key={inv.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 gap-3">
                                        <span className="text-sm">
                                            Vous avez été invité à rejoindre <strong>{inv.workspace.name}</strong>
                                        </span>
                                        <div className="flex items-center gap-2">
                                            <AcceptInvitationButton invId={inv.id} />
                                            <RefuseInvitationButton invId={inv.id} />
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </section>
                )}

                {/* Workspaces */}
                <section>
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 gap-4">
                        <h2 className="text-xl font-semibold">Mes espaces de travail</h2>
                        
                        <form action={createWorkspace} className="flex gap-2">
                            <input 
                                name="name" 
                                placeholder="Nouveau workspace..." 
                                required 
                                className="px-3 py-1.5 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/10 dark:focus:ring-gray-100/10 focus:border-gray-400 dark:focus:border-gray-600 transition-all placeholder:text-gray-400 dark:placeholder:text-gray-500 text-gray-900 dark:text-gray-100"
                            />
                            <button 
                                type="submit"
                                className="bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 text-sm font-medium py-1.5 px-4 rounded-md hover:bg-gray-800 dark:hover:bg-gray-200 transition-colors shadow-sm whitespace-nowrap"
                            >
                                Créer
                            </button>
                        </form>
                    </div>

                    {memberships.length === 0 ? (
                        <div className="p-8 text-center text-gray-500 dark:text-gray-400 border border-gray-200 dark:border-gray-800 border-dashed rounded-lg">
                            Vous n&apos;avez pas encore d&apos;espace de travail.
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {memberships.map((m) => (
                                <Link 
                                    key={`${m.userId}-${m.workspaceId}`} 
                                    href={`/workspaces/${m.workspaceId}`}
                                    className="group p-5 border border-gray-200 dark:border-gray-800 rounded-xl hover:border-gray-400 dark:hover:border-gray-600 hover:shadow-sm transition-all bg-white dark:bg-gray-900 flex flex-col justify-between h-32"
                                >
                                    <div>
                                        <h3 className="font-semibold text-lg group-hover:text-gray-900 dark:group-hover:text-gray-100 transition-colors">
                                            {m.workspace.name}
                                        </h3>
                                    </div>
                                    <div className="flex justify-between items-center mt-4">
                                        <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 border border-transparent dark:border-gray-700">
                                            {m.role}
                                        </span>
                                        <span className="text-gray-400 dark:text-gray-500 group-hover:text-gray-900 dark:group-hover:text-gray-100 transition-colors text-sm">
                                            Ouvrir →
                                        </span>
                                    </div>
                                </Link>
                            ))}
                        </div>
                    )}
                </section>
            </div>
        </main>
    );
}