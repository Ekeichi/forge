"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";

export default function SignUpPage() {
    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState<string | null>(null);
    const router = useRouter();

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setError(null);
        const { error } = await authClient.signUp.email({ email, password, name });
        if (error) {
            setError(error.message ?? "Erreur lors de l'inscription");
            return;
        }
        router.push("/profil");
    }

    return (
        <main style={{ padding: 32 }}>
            <h1>Créer un compte</h1>
            <form onSubmit={handleSubmit}>
                <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nom" required />
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email@exemple.com" required />
                <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Mot de passe" required minLength={8} />
                <button type="submit">S&apos;inscrire</button>
            </form>
            {error && <p style={{ color: "red" }}>{error}</p>}
        </main>
    );
}