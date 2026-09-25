import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// GitHub Pages : le jeu est servi sous /<nom-du-repo>/.
// BASE_PATH est fourni par le workflow de déploiement ; sinon on utilise
// des chemins relatifs ('./'), qui fonctionnent sur n'importe quel sous-chemin.
const base = process.env.BASE_PATH || './';

export default defineConfig({
  base,
  plugins: [react()],
  build: {
    outDir: 'dist',
    target: 'es2020',
    chunkSizeWarningLimit: 1200,
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
} as any);
