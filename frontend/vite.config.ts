import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vitejs.dev/config/
export default defineConfig({
  // Base path for deployment
  base: "/",
  plugins: [react()],
  server: {
    port: 8181, // Set the frontend server port to 8181
    host: "0.0.0.0", // Allow connections from outside the container
    strictPort: true, // Fail if port is already in use
    hmr: {
      // Allow HMR from any host
      host: "0.0.0.0",
      port: 8181,
      clientPort: 8181,
    },
    cors: {
      // Use UI_ENDPOINT environment variable for CORS origin
      origin: process.env.UI_ENDPOINT,
    },
    fs: {
      // Allow serving files from one level up
      allow: [".."],
    },
  },
  define: {
    "process.env": process.env,
    "import.meta.env.VITE_API_ENDPOINT": JSON.stringify(
      process.env.VITE_API_ENDPOINT
    ),
    // Add UI_ENDPOINT environment variable to be accessible in the browser
    "import.meta.env.UI_ENDPOINT": JSON.stringify(process.env.UI_ENDPOINT),
  },
});
