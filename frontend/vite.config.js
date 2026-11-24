import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'fs'
import path from 'path'

const hasRealFirebase = fs.existsSync(path.resolve(__dirname, 'node_modules/firebase/auth'))

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: hasRealFirebase
      ? {}
      : {
          'firebase/app': path.resolve(__dirname, 'src/lib/firebase-shim.js'),
          'firebase/auth': path.resolve(__dirname, 'src/lib/firebase-shim.js'),
        },
  },
  server: {
    // Proxy API requests to backend running on port 8000
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
        secure: false,
      },
    },
  },
})
