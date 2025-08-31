import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // FIX: Replace `process.cwd()` with `'.'` to resolve a TypeScript error where `cwd` is not found on `process`.
  // This is functionally equivalent for `loadEnv` in a standard Vite setup.
  const env = loadEnv(mode, '.', '');
  return {
    plugins: [react()],
    define: {
      'process.env.API_KEY': JSON.stringify(env.VITE_API_KEY)
    }
  }
})