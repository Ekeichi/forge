"use client";

import { deleteDocument } from "./actions";

interface DeleteDocumentButtonProps {
    documentId: string;
    workspaceId: string;
}

export function DeleteDocumentButton({ documentId, workspaceId }: DeleteDocumentButtonProps) {
    return (
        <button
            type="button"
            onClick={async (e) => {
                e.preventDefault();
                e.stopPropagation();
                await deleteDocument(documentId, workspaceId);
            }}
            className="text-gray-400 dark:text-gray-500 group-hover:text-red-500 dark:group-hover:text-red-400 transition-colors text-sm"
        >
            Supprimer
        </button>
    );
}
