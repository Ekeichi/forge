"use client";
import { AcceptInvitation } from "@/app/profil/actions";

export function AcceptInvitationButton({ invId }: { invId: string }) {
    async function handleSubmit() {
        const result = await AcceptInvitation({ invId });
    }
    return <button onClick={handleSubmit}>Accepter l'invitation</button>;
}

