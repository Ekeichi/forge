// src/app/workspaces/page.tsx
import Link from "next/link";

export default async function Home() {
  return (
    <main style={{ padding: 32 }}>
      <h1>FORGE</h1>
      <br />
      <form>
        <Link href="/sign-up">inscription</Link>
        <br />
        <Link href="/sign-in">connexion</Link>
      </form>

    </main>
  );
}