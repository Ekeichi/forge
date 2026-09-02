"use client";
import { refuseInvitation } from "@/app/profil/actions";

export function RefuseInvitationButton({ invId }: { invId: string }) {
    async function handleSubmit() {
        const result = await refuseInvitation({ invId });
    }
    return (
        <button 
            onClick={handleSubmit}
            className="bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 text-xs font-medium py-1.5 px-3 rounded hover:bg-gray-50 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-gray-100 transition-colors shadow-sm"
        >
            Refuser
        </button>
    );
}
