import { defineConfig, loadEnv } from "vite";
import vue from "@vitejs/plugin-vue";
import vuetify from "vite-plugin-vuetify";
import { VitePWA } from "vite-plugin-pwa";

const path = require("path");

// https://vitejs.dev/config/
export default ({ mode }) => {
  // Load app-level env vars to node-level env vars.
  process.env = { ...process.env, ...loadEnv(mode, process.cwd()) };

  const isElectronBuild = process.env.ELECTRON_BUILD === "true";
  // ELECTRON_BUILD só é setado nos scripts de BUILD (electron:build/publish/
  // pack/preview) — o dev normal (electron:dev) sobe o Vite sem essa flag,
  // então o plugin de PWA ficava ativo mesmo rodando dentro do Electron o
  // tempo todo, registrando um Service Worker que o Electron não sabe lidar
  // direito (erro "Failed to register a ServiceWorker: The document is in
  // an invalid state" no console, toda vez que abria o app em dev). Flag
  // própria pra não mexer em ELECTRON_BUILD (que também troca "base" pra
  // caminho relativo — não queremos isso no dev server, só no build real).
  const disablePwa = isElectronBuild || process.env.VITE_DISABLE_PWA === "true";

  return defineConfig({
    // Em builds para Electron, usa caminhos relativos (file://)
    base: isElectronBuild ? "./" : (process.env.VITE_BASE_URL ?? "/"),
    plugins: [
      vue(),
      // https://github.com/vuetifyjs/vuetify-loader/tree/next/packages/vite-plugin
      vuetify({
        autoImport: true,
      }),
      // PWA desativado dentro do Electron, dev ou build (service workers não
      // funcionam com file:// nem fazem sentido num app desktop) — ver
      // comentário de disablePwa acima.
      !disablePwa && VitePWA({
        registerType: "autoUpdate",
        devOptions: {
          enabled: true,
        },
        workbox: {
          globPatterns: ["**/*.{html,js,css,svg,png}"], // Arquivos que o Service Worker deve cachear
        },
        manifest: {
          name: "LouvorJA",
          short_name: "LouvorJA",
          description: "Software de músicas para Louvor e Adoração",
          start_url: process.env.VITE_BASE_URL ?? "/",
          display: "standalone",
          background_color: "#000000",
          theme_color: "#000000",
          icons: [
            {
              src: (process.env.VITE_BASE_URL ?? "/") + "ico/favicon-16x16.png",
              sizes: "16x16",
              type: "image/png",
            },
            {
              src: (process.env.VITE_BASE_URL ?? "/") + "ico/favicon-32x32.png",
              sizes: "32x32",
              type: "image/png",
            },
            {
              src:
                (process.env.VITE_BASE_URL ?? "/") + "ico/favicon-144x144.png",
              sizes: "144x144",
              type: "image/png",
            },
            {
              src:
                (process.env.VITE_BASE_URL ?? "/") + "ico/favicon-152x152.png",
              sizes: "152x152",
              type: "image/png",
            },
            {
              src:
                (process.env.VITE_BASE_URL ?? "/") + "ico/favicon-180x180.png",
              sizes: "180x180",
              type: "image/png",
            },
          ],
        },
      }),
    ].filter(Boolean),
    define: {
      "process.env": {},
      __VUE_PROD_HYDRATION_MISMATCH_DETAILS__: "true",
      __IS_ELECTRON__: JSON.stringify(isElectronBuild),
    },
    build: isElectronBuild ? {
      // O polyfill de modulePreload injeta <link rel="preload"> que o Electron
      // bloqueia via file:// — desativa para evitar "Unable to preload CSS"
      modulePreload: { polyfill: false },
    } : {},
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "src"),
      },
    },
    server: {
      port: 5002,
    },
    /* remove the need to specify .vue files https://vitejs.dev/config/#resolve-extensions
  resolve: {
    extensions: [
      '.js',
      '.json',
      '.jsx',
      '.mjs',
      '.ts',
      '.tsx',
      '.vue',
    ]
  },
  */
  });
};
