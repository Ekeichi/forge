"use client";
import { AcceptInvitation } from "@/app/profil/actions";

export function AcceptInvitationButton({ invId }: { invId: string }) {
    async function handleSubmit() {
        const result = await AcceptInvitation({ invId });
    }
    return (
        <button 
            onClick={handleSubmit}
            className="bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 text-xs font-medium py-1.5 px-3 rounded hover:bg-gray-800 dark:hover:bg-gray-200 transition-colors shadow-sm"
        >
            Accepter
        </button>
    );
}

