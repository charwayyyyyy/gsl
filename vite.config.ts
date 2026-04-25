import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tsconfigPaths from "vite-tsconfig-paths";
import { traeBadgePlugin } from 'vite-plugin-trae-solo-badge';

// https://vite.dev/config/
export default defineConfig({
  build: {
    sourcemap: 'hidden',
    chunkSizeWarningLimit: 400,
    assetsInlineLimit: 4096,
    minify: 'esbuild',
    rollupOptions: {
      output: {
        manualChunks: {
          // React core — stable, browsers cache indefinitely
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          // Three.js — heavy 3D lib (~600KB) only used in Interpreter
          'vendor-three': ['three'],
          // Small utility libs
          'vendor-utils': ['zustand', 'lucide-react', 'clsx', 'tailwind-merge'],
        },
      },
    },
  },
  server: {
    host: '0.0.0.0', // Listen on all interfaces (including 127.0.0.1)
    port: 5173,
    allowedHosts: true, // Allow ngrok
    watch: {
      ignored: [
        '**/.venv/**',
        '**/api/**',
        '**/backend/**',
        '**/data/**',
        '**/data_pipeline/**',
        '**/ml/**',
        '**/scratch/**',
        '**/scripts/**',
        '**/tests/**',
        '**/*.db',
        '**/*.sqlite',
      ],
    },
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
        secure: false,
        ws: true,
      },
      '/health': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
        secure: false,
      },
      '/static': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
        secure: false,
      }
    }
  },
  optimizeDeps: {
    include: ['react', 'react-dom', 'react-router-dom', 'three', 'zustand', 'lucide-react', 'clsx', 'tailwind-merge'],
  },
  plugins: [
    react(),
    traeBadgePlugin({
      variant: 'dark',
      position: 'bottom-right',
      prodOnly: true,
      clickable: true,
      clickUrl: 'https://www.trae.ai/solo?showJoin=1',
      autoTheme: true,
      autoThemeTarget: '#root'
    }),
    tsconfigPaths()
  ],
})
