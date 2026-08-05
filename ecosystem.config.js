module.exports = {
  apps: [
    {
      name: "URLATE-v3l-frontend",
      script: "dist/index.js",

      // 재시작은 배포 워크플로의 pm2 startOrReload가 담당합니다.
      // watch를 켜면 rsync 복사 도중 재시작이 걸릴 수 있습니다.
      watch: false,
    },
  ],
};
