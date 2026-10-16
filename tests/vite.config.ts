import { defineConfig } from "vite";
import { fileURLToPath } from "node:url";
export default defineConfig({
  root: fileURLToPath(new URL("./browser", import.meta.url)),
  resolve: {
    alias: [
      { find: /^react-native$/, replacement: "react-native-web" },
      {
        find: /^@getpaseo\/plugin\/client\/ui$/,
        replacement: fileURLToPath(new URL("./browser/ui.ts", import.meta.url)),
      },
      {
        find: /^@getpaseo\/plugin\/client$/,
        replacement: fileURLToPath(new URL("./browser/host.ts", import.meta.url)),
      },
    ],
  },
  define: { global: "globalThis" },
  esbuild: { jsx: "automatic" },
  server: { host: "127.0.0.1", port: 4197 },
});
