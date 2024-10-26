// server.js
const express = require("express");
const http = require("http");
const WebSocket = require("ws");
const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

app.use(express.static("public"));

const ipSessions = {};

function broadcastToIP(ip, message) {
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN && client.ip === ip) {
      client.send(message);
      console.log(`Broadcasting to IP ${ip}:`, message);
    }
  });
}

wss.on("connection", (ws, req) => {
  const clientIP =
    req.headers["x-forwarded-for"] || req.connection.remoteAddress;
  ws.ip = clientIP;
  console.log(`New connection from IP: ${clientIP}`);

  if (ipSessions[clientIP]) {
    if (ipSessions[clientIP].text) {
      ws.send(
        JSON.stringify({ type: "text", data: ipSessions[clientIP].text })
      );
    }
    if (ipSessions[clientIP].file) {
      ws.send(
        JSON.stringify({
          type: "file",
          fileName: ipSessions[clientIP].fileName,
          fileType: ipSessions[clientIP].fileType,
        })
      );
      ws.send(ipSessions[clientIP].file); // Send binary data separately
    }
  }

  ws.on("message", (data, isBinary) => {
    if (isBinary) {
      const fileBuffer = Buffer.from(new Uint8Array(data));
      ipSessions[clientIP] = ipSessions[clientIP] || {};
      ipSessions[clientIP].file = fileBuffer;
      console.log(`Received binary file data from IP ${clientIP}.`);
    } else {
      const message = JSON.parse(data);

      if (message.type === "text") {
        ipSessions[clientIP] = ipSessions[clientIP] || {};
        ipSessions[clientIP].text = message.data;
        console.log(`Received text from IP ${clientIP}: ${message.data}`);
        broadcastToIP(
          clientIP,
          JSON.stringify({ type: "text", data: message.data })
        );
      } else if (message.type === "file") {
        ipSessions[clientIP] = ipSessions[clientIP] || {};
        ipSessions[clientIP].fileName = message.fileName;
        ipSessions[clientIP].fileType = message.fileType;
        console.log(
          `Received file metadata from IP ${clientIP}: ${message.fileName}`
        );
      }
    }
  });

  ws.on("close", () => console.log(`Connection closed for IP: ${clientIP}`));
  ws.on("error", (error) => console.error(`Error on IP ${clientIP}:`, error));
});

server.listen(3000, () => {
  console.log("Server running on http://localhost:3000");
});
