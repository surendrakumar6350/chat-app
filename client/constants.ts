export const WEB_SOCKET_ADDRESS =
  process.env.NODE_ENV === "production"
    ? "wss://chat.speedexchange.in/ws/"
    : "ws://localhost:8080";
