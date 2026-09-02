// src/app/page.tsx
import Link from "next/link";
import { ThemeToggle } from "@/components/theme-toggle";

export default async function Home() {
  return (
    <main className="min-h-screen bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 flex flex-col items-center justify-center p-6 relative">
      <div className="absolute top-6 right-6">
        <ThemeToggle />
      </div>
      <div className="w-full max-w-md mx-auto text-center space-y-8">
        
        {/* Logo / Titre */}
        <div className="space-y-4">
          <h1 className="text-4xl font-extrabold tracking-tight text-gray-900 dark:text-gray-50">FORGE</h1>
          <p className="text-gray-500 dark:text-gray-400">Gérez vos espaces de travail simplement.</p>
        </div>

        {/* Boutons d'action */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
          <Link 
            href="/sign-in"
            className="flex-1 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 text-gray-900 dark:text-gray-100 font-medium py-2.5 px-6 rounded-md hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors shadow-sm text-center"
          >
            Connexion
          </Link>
          <Link 
            href="/sign-up"
            className="flex-1 bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 font-medium py-2.5 px-6 rounded-md hover:bg-gray-800 dark:hover:bg-gray-200 transition-colors shadow-sm text-center"
          >
            Inscription
          </Link>
        </div>
      </div>
    </main>
  );
}