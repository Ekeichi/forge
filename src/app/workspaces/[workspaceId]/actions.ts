"use server";

import { rag } from "@/lib/rag";

export async function askRAG(query: string, workspaceId: string) {
    return rag(query, workspaceId);
}