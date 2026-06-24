import { defineConfig } from "vite";

export default defineConfig({
  envPrefix: ["LIVEAVATAR_", "ELEVENLABS_", "TAVUS_"],
  build: {
    rollupOptions: {
      input: {
        main:  "index.html",
        tavus: "tavus.html",
      },
    },
  },
});
