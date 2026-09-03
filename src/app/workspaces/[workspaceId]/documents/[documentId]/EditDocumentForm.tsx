"use client";

import { useActionState } from "react";
import { saveContent } from "../actions";

type State = { error?: string; success?: boolean } | null;

export function EditDocumentForm({
    documentId,
    workspaceId,
    defaultTitle,
    defaultContent,
}: {
    documentId: string;
    workspaceId: string;
    defaultTitle: string;
    defaultContent: string;
}) {
    const [state, formAction, pending] = useActionState<State, FormData>(
        async (_prev, formData) => await saveContent(formData),
        null
    );


    const inputClass =
        "px-3 py-2 bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-700 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/10 dark:focus:ring-gray-100/10 focus:border-gray-400 dark:focus:border-gray-500 transition-all placeholder:text-gray-400 dark:placeholder:text-gray-500";

    return (
        <form action={formAction} className="flex flex-col gap-4">
            <input type="hidden" name="documentId" value={documentId} />
            <input type="hidden" name="workspaceId" value={workspaceId} />

            <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                    Titre
                </label>
                <input
                    type="text"
                    name="title"
                    defaultValue={defaultTitle}
                    placeholder="Titre du document"
                    required
                    className={inputClass}
                />
            </div>

            <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                    Contenu
                </label>
                <textarea
                    name="content"
                    defaultValue={defaultContent}
                    rows={14}
                    placeholder="Écrivez votre contenu ici..."
                    className={`${inputClass} resize-none font-mono leading-relaxed`}
                />
            </div>

            <div className="flex items-center justify-between pt-1">
                <div>
                    {state?.error && (
                        <p className="text-xs text-red-500 dark:text-red-400">{state.error}</p>
                    )}
                    {state?.success && (
                        <p className="text-xs text-green-600 dark:text-green-400">Document sauvegardé ✓</p>
                    )}
                </div>
                <button
                    type="submit"
                    disabled={pending}
                    className="bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 text-sm font-medium py-2 px-5 rounded-md hover:bg-gray-800 dark:hover:bg-gray-200 transition-colors shadow-sm disabled:opacity-50"
                >
                    {pending ? "Sauvegarde..." : "Sauvegarder"}
                </button>
            </div>
        </form>
    );
}
