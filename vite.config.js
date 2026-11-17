import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('.', import.meta.url))

export default defineConfig({
  plugins: [react()],
  // './' lets the built site work from any folder or subpath (Netlify, GitHub Pages, a USB stick)
  base: './',
  // one copy of React for the 3D library and the app
  resolve: { dedupe: ['react', 'react-dom'] },
  optimizeDeps: { include: ['three', '@react-three/fiber'] },
  build: {
    rollupOptions: {
      input: {
        public: resolve(root, 'index.html'),
        staff: resolve(root, 'staff/walk-in/index.html'),
      },
    },
  },
})
