import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Load env file based on `mode` in the current working directory.
  // Set the third parameter to '' to load all env regardless of the `VITE_` prefix.
  const env = loadEnv(mode, (process as any).cwd(), '');

  return {
    plugins: [react()],
    define: {
      // By default, Vite doesn't define `process.env`.
      // We need to explicitly define `process.env.API_KEY` so it's replaced at build time
      // with the actual value from the environment.
      'process.env.API_KEY': JSON.stringify(env.API_KEY),
      // Also define process.env as an empty object to prevent crashes if other libs access it
      'process.env': {},
    },
    // Proxy configuration for local development to bypass CORS
    server: {
      proxy: {
        '/api/kv': {
          target: 'https://keyvalue.immanuel.co/api/Key/Value',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api\/kv/, ''),
        },
      },
    },
  };
});