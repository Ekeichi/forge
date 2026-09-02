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
        <main className="min-h-screen bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 flex flex-col items-center justify-center p-6">
            <div className="w-full max-w-sm mx-auto space-y-6">
                
                <div className="text-center space-y-2 mb-8">
                    <h1 className="text-2xl font-bold tracking-tight">Se connecter</h1>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Heureux de vous revoir sur Forge</p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-1">
                        <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Email</label>
                        <input 
                            type="email" 
                            value={email} 
                            onChange={(e) => setEmail(e.target.value)} 
                            placeholder="email@exemple.com" 
                            required 
                            className="w-full px-3 py-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/10 dark:focus:ring-gray-100/10 focus:border-gray-400 dark:focus:border-gray-600 transition-all placeholder:text-gray-400 dark:placeholder:text-gray-500 text-gray-900 dark:text-gray-100"
                        />
                    </div>
                    
                    <div className="space-y-1">
                        <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Mot de passe</label>
                        <input 
                            type="password" 
                            value={password} 
                            onChange={(e) => setPassword(e.target.value)} 
                            placeholder="••••••••" 
                            required 
                            className="w-full px-3 py-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/10 dark:focus:ring-gray-100/10 focus:border-gray-400 dark:focus:border-gray-600 transition-all placeholder:text-gray-400 dark:placeholder:text-gray-500 text-gray-900 dark:text-gray-100"
                        />
                    </div>
                    
                    <button 
                        type="submit"
                        className="w-full bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 font-medium py-2 px-4 rounded-md hover:bg-gray-800 dark:hover:bg-gray-200 transition-colors shadow-sm mt-2"
                    >
                        Se connecter
                    </button>
                </form>

                {error && (
                    <div className="p-3 text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/50 rounded-md border border-red-100 dark:border-red-900/50">
                        {error}
                    </div>
                )}

                <div className="text-center text-sm text-gray-500 dark:text-gray-400 pt-4 border-t border-gray-100 dark:border-gray-800">
                    Pas encore de compte ?{" "}
                    <Link href="/sign-up" className="font-medium text-gray-900 dark:text-gray-100 hover:underline">
                        S&apos;inscrire
                    </Link>
                </div>
            </div>
        </main>
    );
}