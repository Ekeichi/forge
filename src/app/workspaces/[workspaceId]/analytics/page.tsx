import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";

function fmt(ms: number | null) {
    if (ms === null) return "—";
    if (ms < 1000) return `${ms} ms`;
    return `${(ms / 1000).toFixed(1)} s`;
}

function fmtScore(score: number | null) {
    if (score === null) return "—";
    return score.toFixed(3);
}

export default async function AnalyticsPage({ params }: { params: Promise<{ workspaceId: string }> }) {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) redirect("/sign-in");

    const { workspaceId } = await params;

    const workspace = await prisma.workspace.findFirst({
        where: {
            id: workspaceId,
            memberships: { some: { userId: session.user.id } },
        },
    });

    if (!workspace) notFound();

    const runs = await prisma.agentRun.findMany({
        where: { workspaceId },
        orderBy: { createdAt: "desc" },
        take: 50,
    });

    // KPIs agrégés
    const total = runs.length;
    const withTool = runs.filter(r => r.toolCalled).length;
    const toolRate = total > 0 ? Math.round((withTool / total) * 100) : 0;
    const successRate = total > 0
        ? Math.round((runs.filter(r => r.success).length / total) * 100)
        : 0;
    const avgLatency = total > 0
        ? Math.round(runs.reduce((acc, r) => acc + (r.latencyMs ?? 0), 0) / total)
        : null;
    // p95 : une moyenne masque les runs qui partent en boucle
    const p95Latency = (() => {
        const values = runs.map(r => r.latencyMs).filter((v): v is number => v !== null).sort((a, b) => a - b);
        if (values.length === 0) return null;
        return values[Math.min(values.length - 1, Math.ceil(values.length * 0.95) - 1)];
    })();
    const avgIterations = (() => {
        const values = runs.map(r => r.iterations).filter((v): v is number => v !== null);
        if (values.length === 0) return null;
        return values.reduce((a, b) => a + b, 0) / values.length;
    })();
    const totalInputTokens = runs.reduce((acc, r) => acc + (r.inputTokens ?? 0), 0);
    const totalOutputTokens = runs.reduce((acc, r) => acc + (r.outputTokens ?? 0), 0);
    const avgTopScore = (() => {
        const scored = runs.filter(r => r.topScore !== null);
        if (scored.length === 0) return null;
        return scored.reduce((acc, r) => acc + (r.topScore ?? 0), 0) / scored.length;
    })();

    return (
        <main className="min-h-screen bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 py-12 px-6">
            <div className="max-w-6xl mx-auto space-y-10">

                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-gray-100 dark:border-gray-800 pb-6 gap-4">
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight">Analytics</h1>
                        <p className="text-gray-500 dark:text-gray-400 mt-1 text-sm">{workspace.name} · pipeline RAG</p>
                    </div>
                    <Link
                        href={`/workspaces/${workspaceId}`}
                        className="text-sm font-medium text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 transition-colors"
                    >
                        ← Retour au workspace
                    </Link>
                </div>

                {/* KPI cards */}
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
                    {[
                        { label: "Requêtes totales", value: total.toString() },
                        { label: "Taux de succès", value: `${successRate} %` },
                        { label: "Latence moy. / p95", value: `${fmt(avgLatency)} / ${fmt(p95Latency)}` },
                        { label: "Taux tool_use", value: `${toolRate} %` },
                        { label: "Tours moyens", value: avgIterations !== null ? avgIterations.toFixed(2) : "—" },
                        { label: "Top score moyen", value: avgTopScore !== null ? fmtScore(avgTopScore) : "—" },
                    ].map(({ label, value }) => (
                        <div
                            key={label}
                            className="bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-xl p-4"
                        >
                            <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">{label}</p>
                            <p className="text-2xl font-bold tracking-tight">{value}</p>
                        </div>
                    ))}
                </div>

                {/* Tokens split */}
                <div className="bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-xl p-5">
                    <p className="text-sm font-medium mb-3">Répartition des tokens</p>
                    <div className="flex items-center gap-6 text-sm">
                        <span>
                            <span className="text-gray-500 dark:text-gray-400 mr-1">Entrée :</span>
                            <span className="font-semibold">{totalInputTokens.toLocaleString("fr-FR")}</span>
                        </span>
                        <span>
                            <span className="text-gray-500 dark:text-gray-400 mr-1">Sortie :</span>
                            <span className="font-semibold">{totalOutputTokens.toLocaleString("fr-FR")}</span>
                        </span>
                        <span>
                            <span className="text-gray-500 dark:text-gray-400 mr-1">Total :</span>
                            <span className="font-semibold">{(totalInputTokens + totalOutputTokens).toLocaleString("fr-FR")}</span>
                        </span>
                    </div>
                </div>

                {/* Table */}
                <section>
                    <h2 className="text-lg font-semibold mb-4">Runs récents <span className="text-gray-400 dark:text-gray-500 font-normal text-base">(50 derniers)</span></h2>
                    {runs.length === 0 ? (
                        <p className="text-gray-500 dark:text-gray-400 text-sm">Aucun run enregistré pour ce workspace.</p>
                    ) : (
                        <div className="overflow-x-auto rounded-xl border border-gray-100 dark:border-gray-800">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="bg-gray-50 dark:bg-gray-900 text-gray-500 dark:text-gray-400 text-xs uppercase tracking-wide">
                                        <th className="px-4 py-3 text-left font-medium">Date</th>
                                        <th className="px-4 py-3 text-left font-medium">Question</th>
                                        <th className="px-4 py-3 text-center font-medium">RAG</th>
                                        <th className="px-4 py-3 text-center font-medium">Fin</th>
                                        <th className="px-4 py-3 text-right font-medium">Latence</th>
                                        <th className="px-4 py-3 text-right font-medium">Top score</th>
                                        <th className="px-4 py-3 text-right font-medium">Avg score</th>
                                        <th className="px-4 py-3 text-right font-medium">Chunks</th>
                                        <th className="px-4 py-3 text-right font-medium">Tokens</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                                    {runs.map((run) => (
                                        <tr key={run.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-900/50 transition-colors">
                                            <td className="px-4 py-3 text-gray-400 dark:text-gray-500 whitespace-nowrap tabular-nums text-xs">
                                                {run.createdAt.toLocaleDateString("fr-FR", {
                                                    day: "2-digit", month: "2-digit",
                                                    hour: "2-digit", minute: "2-digit",
                                                })}
                                            </td>
                                            <td className="px-4 py-3 max-w-xs">
                                                <p className="truncate" title={run.input}>{run.input}</p>
                                                {run.toolQuery && run.toolQuery !== run.input && (
                                                    <p className="text-xs text-gray-400 dark:text-gray-500 truncate mt-0.5" title={run.toolQuery}>
                                                        ↳ {run.toolQuery}
                                                    </p>
                                                )}
                                            </td>
                                            <td className="px-4 py-3 text-center">
                                                {!run.toolCalled ? (
                                                    <span className="inline-block px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400">direct</span>
                                                ) : (
                                                    <div className="flex flex-wrap justify-center gap-1">
                                                        {run.toolNames?.split(", ").map(name => (
                                                            <span key={name} className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
                                                                name === "search_documents"
                                                                    ? "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300"
                                                                    : "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300"
                                                            }`}>{name === "search_documents" ? "RAG" : "créer doc"}</span>
                                                        ))}
                                                    </div>
                                                )}
                                            </td>
                                            <td className="px-4 py-3 text-center whitespace-nowrap">
                                                <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
                                                    run.success
                                                        ? "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300"
                                                        : "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300"
                                                }`} title={`${run.stopReason ?? "?"}${run.toolErrors > 0 ? ` · ${run.toolErrors} erreur(s) outil` : ""}`}>
                                                    {run.stopReason ?? "—"}
                                                </span>
                                                {run.iterations !== null && (
                                                    <span className="text-xs text-gray-400 dark:text-gray-500 ml-1.5 tabular-nums">
                                                        {run.iterations}t
                                                    </span>
                                                )}
                                            </td>
                                            <td className="px-4 py-3 text-right tabular-nums text-gray-600 dark:text-gray-300">
                                                {fmt(run.latencyMs)}
                                            </td>
                                            <td className="px-4 py-3 text-right tabular-nums">
                                                {run.topScore !== null ? (
                                                    <span className={run.topScore >= 0.7 ? "text-green-600 dark:text-green-400 font-medium" : run.topScore >= 0.4 ? "text-yellow-600 dark:text-yellow-400" : "text-red-500 dark:text-red-400"}>
                                                        {fmtScore(run.topScore)}
                                                    </span>
                                                ) : "—"}
                                            </td>
                                            <td className="px-4 py-3 text-right tabular-nums text-gray-500 dark:text-gray-400">
                                                {fmtScore(run.averageScore)}
                                            </td>
                                            <td className="px-4 py-3 text-right tabular-nums text-gray-500 dark:text-gray-400">
                                                {run.resultCount ?? "—"}
                                            </td>
                                            <td className="px-4 py-3 text-right tabular-nums text-gray-500 dark:text-gray-400 text-xs">
                                                {run.inputTokens !== null && run.outputTokens !== null
                                                    ? `${(run.inputTokens + run.outputTokens).toLocaleString("fr-FR")}`
                                                    : "—"}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </section>

            </div>
        </main>
    );
}
