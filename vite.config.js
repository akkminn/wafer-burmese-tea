import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // './' lets the built site work from any folder or subpath (Netlify, GitHub Pages, a USB stick)
  base: './',
  // one copy of React for the 3D library and the app
  resolve: { dedupe: ['react', 'react-dom'] },
  optimizeDeps: { include: ['three', '@react-three/fiber'] },
})
