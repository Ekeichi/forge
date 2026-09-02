import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    // Utilisation de la nouvelle API native pour les tsconfigPaths au lieu du plugin
    // Ce qui enlève le warning `vite-tsconfig-paths` dans votre console
    alias: {
      '@': '/src'
    }
  },
  test: {
    environment: 'node',
    setupFiles: ['./src/test/setup.ts'],
    globals: true,
  },
});
