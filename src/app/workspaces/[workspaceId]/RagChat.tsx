"use client";

import { useState } from "react";
import { askRAG } from "./actions";

export default function RagChat({ workspaceId }: { workspaceId: string }) {
    const [query, setQuery] = useState("");
    const [response, setResponse] = useState("");
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!query.trim() || loading) return;
        setLoading(true);
        const res = await askRAG(query, workspaceId);
        setResponse(res);
        setLoading(false);
    };

    return (
        <div className="space-y-4">
            <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-3">
                <input
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Posez une question sur vos documents..."
                    className="flex-1 px-3 py-2 bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-700 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/10 dark:focus:ring-gray-100/10 focus:border-gray-400 dark:focus:border-gray-500 transition-all placeholder:text-gray-400 dark:placeholder:text-gray-500"
                />
                <button
                    type="submit"
                    disabled={loading || !query.trim()}
                    className="bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 text-sm font-medium py-2 px-4 rounded-md hover:bg-gray-800 dark:hover:bg-gray-200 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
                >
                    {loading ? "Recherche…" : "Envoyer"}
                </button>
            </form>

            {loading && (
                <div className="p-4 bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-lg space-y-2 animate-pulse">
                    <div className="h-3 w-3/4 rounded bg-gray-100 dark:bg-gray-800" />
                    <div className="h-3 w-full rounded bg-gray-100 dark:bg-gray-800" />
                    <div className="h-3 w-1/2 rounded bg-gray-100 dark:bg-gray-800" />
                </div>
            )}

            {!loading && response && (
                <div className="p-4 bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-lg text-sm leading-relaxed whitespace-pre-wrap">
                    {response}
                </div>
            )}
        </div>
    );
}
