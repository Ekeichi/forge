"use client";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";

export function SignOutButton() {
    const router = useRouter();

    async function handleSignOut() {
        await authClient.signOut();
        router.push("/sign-in");
        router.refresh();
    }

    return (
        <button 
            onClick={handleSignOut}
            className="text-sm font-medium text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 transition-colors bg-red-50 dark:bg-red-950/30 hover:bg-red-100 dark:hover:bg-red-900/40 px-4 py-2 rounded-md"
        >
            Se déconnecter
        </button>
    );
}