const { defineConfig } = require("vite");
const cesium = require("vite-plugin-cesium").default;

module.exports = defineConfig({
  plugins: [cesium()],
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
