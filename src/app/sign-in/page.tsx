"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import Link from "next/link";

export default function SignInPage() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState<string | null>(null);
    const router = useRouter();

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setError(null);
        const { error } = await authClient.signIn.email({ email, password });
        if (error) {
            setError(error.message ?? "Identifiants invalides");
            return;
        }
        router.push("/profil");
    }

    return (
        <main style={{ padding: 32 }}>
            <h1>Se connecter</h1>
            <form onSubmit={handleSubmit}>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email@exemple.com" required />
                <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Mot de passe" required />
                <button type="submit">Se connecter</button>
                <br></br>
                <Link href="/sign-up">S'inscrire</Link>
                <br></br>
            </form>
            {error && <p style={{ color: "red" }}>{error}</p>}
        </main>
    );
}