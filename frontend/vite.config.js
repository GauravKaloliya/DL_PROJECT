import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      "/api": {
        target: "http://localhost:5000",
        changeOrigin: true,
        bypass: (req) => {
          // Bypass proxy for /api/docs HTML requests to allow React Router to handle it
          // But allow JSON requests to be proxied to the backend
          if (req.url === '/api/docs' || req.url.startsWith('/api/docs?')) {
            if (req.headers.accept?.includes('text/html')) {
              return req.url; // Let React Router handle HTML navigation
            }
            // For JSON requests (fetch API), return undefined to allow proxy to backend
            return undefined;
          }
        }
      },
      "/admin": "http://localhost:5000"
    }
  }
});
