"use client";

import { useActionState } from "react";
import { addDocument } from "./actions";

type State = { error?: string; success?: boolean } | null;

export function AddDocumentForm({ workspaceId }: { workspaceId: string }) {
    const [state, formAction, pending] = useActionState<State, FormData>(
        async (_prev, formData) => {
            return await addDocument(workspaceId, formData.get("title") as string);
        },
        null
    );

    return (
        <form action={formAction} className="flex flex-col gap-3">
            <div className="flex gap-3">
                <input
                    type="text"
                    name="title"
                    placeholder="Titre du document..."
                    required
                    className="flex-1 px-3 py-2 bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-700 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/10 dark:focus:ring-gray-100/10 focus:border-gray-400 dark:focus:border-gray-500 transition-all placeholder:text-gray-400 dark:placeholder:text-gray-500"
                />
                <button
                    type="submit"
                    disabled={pending}
                    className="bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 text-sm font-medium py-2 px-4 rounded-md hover:bg-gray-800 dark:hover:bg-gray-200 transition-colors shadow-sm whitespace-nowrap disabled:opacity-50"
                >
                    {pending ? "Ajout..." : "Ajouter"}
                </button>
            </div>
            {state?.error && (
                <p className="text-xs text-red-500 dark:text-red-400">{state.error}</p>
            )}
        </form>
    );
}
