const { defineConfig } = require("vite");

module.exports = defineConfig({
  base: "/A_Terns_Perspective/",
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
