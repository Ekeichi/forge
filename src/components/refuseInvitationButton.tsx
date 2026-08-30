"use client";
import { refuseInvitation } from "@/app/profil/actions";

export function RefuseInvitationButton({ invId }: { invId: string }) {
    async function handleSubmit() {
        const result = await refuseInvitation({ invId });
    }
    return <button onClick={handleSubmit}>Refuser</button>;
}
