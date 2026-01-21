const { defineConfig } = require("vite");
const cesium = require("vite-plugin-cesium").default;

module.exports = defineConfig({
  base: "/A_Terns_Perspective/",
  plugins: [
    cesium({
      injectCesiumScript: false
    })
  ],
  server: {
    host: "127.0.0.1",
    port: 5501,
    strictPort: false,
    hmr: false,
    fs: {
      allow: [__dirname]
    }
  }
});
