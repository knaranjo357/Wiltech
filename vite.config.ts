// vite.config.ts
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  return {
    plugins: [react()],

    server: {
      port: 5173,
      host: true,
      open: true,
    },

    preview: {
      port: 4173,
      host: true,
    },

    build: {
      outDir: 'dist',
      sourcemap: false,
      rollupOptions: {
        output: {
          manualChunks: {
            vendor: ['react', 'react-dom'],
            ui: ['lucide-react'],
          },
        },
      },
    },

    optimizeDeps: {
      exclude: ['lucide-react'],
    },

    define: {
      __APP_ENV__: JSON.stringify(env.APP_ENV || mode),
    },
  };
});
