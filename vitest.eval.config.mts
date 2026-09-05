import { defineConfig } from 'vitest/config';

// Config dédiée aux évals : contrairement à vitest.config.mts, aucun mock n'est
// chargé — on tape la vraie base, le vrai embedder et la vraie API Anthropic.
export default defineConfig({
  resolve: {
    alias: {
      '@': '/src',
    },
  },
  test: {
    environment: 'node',
    globals: true,
    include: ['evals/**/*.eval.ts'],
    setupFiles: ['dotenv/config'],
    // Une campagne complète enchaîne des dizaines d'appels modèle.
    testTimeout: 120_000,
    hookTimeout: 900_000,
    fileParallelism: false,
    reporters: ['verbose'],
  },
});
