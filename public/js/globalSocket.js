let isErrorOccured = false;
const socket = io(game, {
  withCredentials: true,
});

socket.on("connect", () => {
  console.log("[Socket.IO] Connected to server");
  if (isErrorOccured) {
    iziToast.success({
      title: "Connected",
      message: "You are connected to server",
      timeout: 2000,
      layout: 2,
      transitionIn: "fadeInLeft",
    });
  }
});

socket.on("disconnect", () => {
  console.error("[Socket.IO] Disconnected from server");
  iziToast.warning({
    title: "Disconnected",
    message: "Trying to reconnect...",
    timeout: 2000,
    layout: 2,
    transitionIn: "fadeInLeft",
  });
  isErrorOccured = true;
});

socket.on("connect_error", () => {
  console.error("[Socket.IO] Cannot connect to server");
  iziToast.error({
    title: "Connection error",
    message: "Trying to reconnect...",
    timeout: 2000,
    layout: 2,
    transitionIn: "fadeInLeft",
  });
  setTimeout(() => {
    socket.connect();
  }, 1000);
  isErrorOccured = true;
});
