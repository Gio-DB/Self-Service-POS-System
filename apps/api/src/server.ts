import { createServer } from "node:http";
import { Server as SocketServer } from "socket.io";
import { createApp } from "./app.js";
import { prisma } from "./db.js";

const port = Number(process.env.API_PORT ?? 3000);
const webOrigin = process.env.WEB_ORIGIN ?? "http://127.0.0.1:5173";
let io: SocketServer | undefined;
const events = {
  emit(eventName: string) {
    io?.emit(eventName);
  },
};
const app = createApp(events);
const httpServer = createServer(app);
io = new SocketServer(httpServer, {
  cors: { origin: webOrigin },
});

httpServer.listen(port, "127.0.0.1", () => {
  console.log(`POS API listening on http://127.0.0.1:${port}`);
});

async function shutdown() {
  io?.close();
  await prisma.$disconnect();
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
