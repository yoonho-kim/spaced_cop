import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  return {
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return;

          if (id.includes('/react/') || id.includes('react-dom')) {
            return 'react';
          }

          if (
            id.includes('framer-motion') ||
            id.includes('gsap') ||
            id.includes('howler') ||
            id.includes('canvas-confetti')
          ) {
            return 'animation';
          }

          if (id.includes('recharts') || id.includes('/d3-')) {
            return 'charts';
          }

          if (id.includes('@supabase/supabase-js')) {
            return 'supabase';
          }

          if (id.includes('lucide-react')) {
            return 'icons';
          }

          return 'vendor';
        },
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  server: {
    proxy: {
      '/api/huggingface': {
        target: 'https://router.huggingface.co',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/huggingface/, '/hf-inference/models/black-forest-labs/FLUX.1-schnell'),
        headers: {
          Authorization: `Bearer ${env.VITE_HUGGINGFACE_API_KEY}`,
        },
        secure: true,
      },
    },
  },
  }
})
