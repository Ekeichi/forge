import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import prisma from "@/lib/prisma";
import { AddDocumentForm } from "./AddDocumentForm";

export default async function DocumentsPage({ params }: { params: Promise<{ workspaceId: string }> }) {
    const { workspaceId } = await params;
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) {
        redirect("/sign-in");
    }

    const documents = await prisma.document.findMany({
        where: { workspaceId },
        include: { owner: true },
        orderBy: { createdAt: "desc" },
    });

    return (
        <main className="min-h-screen bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 py-12 px-6">
            <div className="max-w-5xl mx-auto space-y-12">

                {/* En-tête */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-gray-100 dark:border-gray-800 pb-6 gap-4">
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight">Documents</h1>
                        <p className="text-gray-500 dark:text-gray-400 mt-1 text-sm">
                            {documents.length} document{documents.length !== 1 ? "s" : ""} dans cet espace
                        </p>
                    </div>
                    <Link
                        href={`/workspaces/${workspaceId}`}
                        className="text-sm font-medium text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 transition-colors"
                    >
                        ← Retour au workspace
                    </Link>
                </div>

                {/* Ajouter un document */}
                <section className="bg-gray-50/50 dark:bg-gray-900/50 p-6 rounded-xl border border-gray-100 dark:border-gray-800">
                    <h2 className="text-lg font-semibold mb-1">Nouveau document</h2>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-5">Créez un document dans cet espace de travail.</p>
                    <AddDocumentForm workspaceId={workspaceId} />
                </section>

                {/* Liste des documents */}
                <section>
                    <h2 className="text-lg font-semibold mb-4">Tous les documents</h2>

                    {documents.length === 0 ? (
                        <div className="p-10 text-center text-gray-500 dark:text-gray-400 border border-gray-200 dark:border-gray-800 border-dashed rounded-xl">
                            Aucun document pour le moment. Créez-en un ci-dessus.
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {documents.map((d) => (
                                <Link
                                    key={d.id}
                                    href={`/workspaces/${workspaceId}/documents/${d.id}`}
                                    className="group p-5 border border-gray-200 dark:border-gray-800 rounded-xl hover:border-gray-400 dark:hover:border-gray-600 hover:shadow-sm transition-all bg-white dark:bg-gray-900 flex flex-col justify-between h-32"
                                >
                                    <div>
                                        <h3 className="font-semibold text-sm group-hover:text-gray-900 dark:group-hover:text-gray-100 transition-colors line-clamp-2">
                                            {d.title}
                                        </h3>
                                    </div>
                                    <div className="flex justify-between items-center mt-4">
                                        <span className="text-xs text-gray-400 dark:text-gray-500">
                                            {d.owner.name ?? d.owner.email} · {new Date(d.createdAt).toLocaleDateString("fr-FR")}
                                        </span>
                                        <span className="text-gray-400 dark:text-gray-500 group-hover:text-gray-900 dark:group-hover:text-gray-100 transition-colors text-sm">
                                            →
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
