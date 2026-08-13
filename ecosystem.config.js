module.exports = {
  apps: [
    {
      name: "URLATE-v3l-frontend",
      script: "dist/index.js",

      // Restarts are handled by pm2 startOrReload in the deploy workflow. With
      // watch on, a restart could fire in the middle of the rsync copy.
      watch: false,
    },
  ],
};
