/// <reference types="vitest" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import electron from 'vite-plugin-electron/simple'
import { fileURLToPath } from 'url'
import { dirname, resolve } from 'path'
import { existsSync, readFileSync } from 'fs'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

export default defineConfig({

  plugins: [
    react(),
    electron({
      main: {
        entry: 'electron/main.ts',
        vite: {
          build: {
            rollupOptions: {
              output: {
                format: 'es',
                entryFileNames: '[name].js',
              },
            },
          },
        },
      },
      preload: {
        input: 'electron/preload.ts',
        vite: {
          build: {
            rollupOptions: {
              output: {
                format: 'cjs',
                entryFileNames: '[name].js',
              },
            },
          },
        },
      },
    }),
  ],
  server: {
    port: 5175,
    strictPort: true,
    https: (() => {
      try {
        const keyPath = resolve(__dirname, 'certs/dev.key');
        const certPath = resolve(__dirname, 'certs/dev.crt');

        if (existsSync(keyPath) && existsSync(certPath)) {
          console.log('🔒 HTTPS habilitado (certificados encontrados)');
          return {
            key: readFileSync(keyPath),
            cert: readFileSync(certPath)
          };
        } else {
          console.log('ℹ️  HTTPS desabilitado (certificados não encontrados)');
        }
      } catch (e) {
        console.log('⚠️  Erro ao carregar certificados:', e);
      }
      return undefined;
    })(),
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
})
