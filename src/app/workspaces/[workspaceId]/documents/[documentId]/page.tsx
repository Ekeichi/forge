import { notFound } from "next/navigation";
import Link from "next/link";
import prisma from "@/lib/prisma";
import { getMembership } from "@/lib/dal";
import { EditDocumentForm } from "./EditDocumentForm";

export default async function DocumentPage({
    params,
}: {
    params: Promise<{ workspaceId: string; documentId: string }>;
}) {
    const { workspaceId, documentId } = await params;

    // Etre connecte ne suffit pas : il faut appartenir a ce workspace.
    const membership = await getMembership(workspaceId);
    if (!membership) notFound();

    const doc = await prisma.document.findUnique({
        where: { id: documentId },
        include: { owner: true },
    });

    if (!doc || doc.workspaceId !== workspaceId) notFound();

    return (
        <main className="min-h-screen bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 py-12 px-6">
            <div className="max-w-3xl mx-auto space-y-10">

                {/* En-tête */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-gray-100 dark:border-gray-800 pb-6 gap-4">
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight">{doc.title}</h1>
                        <p className="text-gray-500 dark:text-gray-400 mt-1 text-sm">
                            Par {doc.owner.name ?? doc.owner.email} · Créé le {new Date(doc.createdAt).toLocaleDateString("fr-FR")}
                        </p>
                    </div>
                    <Link
                        href={`/workspaces/${workspaceId}/documents`}
                        className="text-sm font-medium text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 transition-colors whitespace-nowrap"
                    >
                        ← Retour aux documents
                    </Link>
                </div>

                {/* Formulaire d'édition */}
                <section className="bg-gray-50/50 dark:bg-gray-900/50 p-6 rounded-xl border border-gray-100 dark:border-gray-800">
                    <h2 className="text-lg font-semibold mb-1">Éditer le document</h2>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-5">
                        Les modifications sont sauvegardées immédiatement.
                    </p>
                    <EditDocumentForm
                        documentId={doc.id}
                        workspaceId={workspaceId}
                        defaultTitle={doc.title}
                        defaultContent={doc.content ?? ""}
                    />
                </section>

            </div>
        </main>
    );
}
