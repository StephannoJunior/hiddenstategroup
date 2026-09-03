import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

/*
  BUILD SETTINGS — all of it about how quickly the site becomes usable.

  1. A MODERN TARGET. The default output is compiled down for browsers that
     have not existed in years: async/await becomes state machines, spread
     becomes helper calls, class fields become boilerplate. Every phone that
     will ever open this site understands es2020 natively, and the untouched
     code is both smaller to download and faster to parse.

  2. VENDOR SPLIT. React and the router change perhaps twice a year; this site
     changes weekly. Bundled together, every content edit invalidates the
     whole file and returning visitors re-download the framework they already
     have. Split, the vendor chunk stays in cache for months.

  3. INLINE THE TINY THINGS. Anything under 4KB becomes a data URI, which
     turns a round trip — expensive on a phone at a venue — into nothing.

  4. NO SOURCEMAPS IN PRODUCTION. They are large, and they publish a readable
     copy of the source to anyone who asks.
*/
export default defineConfig({
  plugins: [react()],

  build: {
    target: "es2020",
    sourcemap: false,
    assetsInlineLimit: 4096,
    cssCodeSplit: true,
    // A warning at 500KB is noise for a site whose largest chunk is the
    // console, which only ever loads for staff.
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) return undefined;
          if (id.includes("react-router")) return "router";
          if (id.includes("/react-dom/") || id.includes("/react/")) return "react";
          if (id.includes("lucide-react")) return "icons";
          // qrcode and jszip are already imported dynamically at their point
          // of use, so they never reach here.
          return "vendor";
        },
      },
    },
  },

  /*
    Pre-bundled on first `npm run dev` rather than discovered one import at a
    time, which is what makes the first page load in development slow.
  */
  optimizeDeps: {
    include: ["react", "react-dom", "react-router-dom", "lucide-react"],
  },
});
