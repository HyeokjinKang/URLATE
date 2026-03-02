module.exports = {
  apps: [
    {
      name: "URLATE-v3l-frontend",
      script: "dist/index.js",
      watch: true,
      ignore_watch: ["logs"],
    },
  ],
};
