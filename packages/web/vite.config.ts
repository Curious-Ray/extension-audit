import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Base path: '/' for local/Vercel/server hosting, '/<repo>/' for GitHub Pages
// project sites. The Pages workflow sets VITE_BASE=/extension-audit/.
const base = process.env.VITE_BASE ?? '/';

export default defineConfig({
  base,
  plugins: [react()],
  server: { port: 5173 },
});
