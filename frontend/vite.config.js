import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      "/api": {
        target: "http://localhost:5000",
        bypass: (req) => {
          // Bypass proxy for /api/docs to allow React Router to handle it
          if (req.url === '/api/docs' && req.headers.accept?.includes('text/html')) {
            return req.url;
          }
        }
      },
      "/admin": "http://localhost:5000"
    }
  }
});
