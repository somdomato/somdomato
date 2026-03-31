import { createServer } from "node:http";
import next from "next";
import { Server } from "socket.io";
import { restorePendingAutoApprovals } from "@/lib/upload";

const dev = process.env.NODE_ENV !== "production";
const hostname = dev ? "localhost" : "somdomato.com";
const port = 3000;
const app = next({ dev, hostname, port });
const handler = app.getRequestHandler();
let io: Server;

app.prepare().then(() => {
  const server = createServer(handler);
  io = new Server(server);
  global.io = io;

  io.on("connection", (socket) => {
    console.log("Client connected:", socket.id);
  });

  server.listen(port);
  console.log(`🚀 Server listening on port ${hostname}:${port}`);

  // Restore any pending auto-approvals from before server restart
  restorePendingAutoApprovals();
});
