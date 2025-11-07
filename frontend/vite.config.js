import { defineConfig } from 'vite'
import tailwindcss from "@tailwindcss/vite";
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [tailwindcss(), react()],
  server: {
    proxy: {
      "/api": {
        target: "http://localhost:5000",
        changeOrigin: true,
        secure: false,
      },
    },
  },
  optimizeDeps: {
    include: ['plotly.js-dist-min', 'react-plotly.js'],
    exclude: ['plotly.js-dist'] // Exclude the full version, use minified
  },
  build: {
    commonjsOptions: {
      include: [/node_modules/],
    },
  },
});
