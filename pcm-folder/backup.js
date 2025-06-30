const express = require("express");
const http = require("http");
const fs = require("fs");
const path = require("path");
const { Server } = require("socket.io");

// Create uploads directory if it doesn't exist
const uploadDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir);
}

const app = express();
const server = http.createServer(app);

// Initialize socket server
connectSocketServer(server);

// Start listening
server.listen(4000, () => {
  console.log("✅ Socket server running on http://localhost:4000");
});

// =========================
// 🔌 SOCKET SETUP FUNCTION
// =========================
function connectSocketServer(server) {
  const io = new Server(server, {
    cors: { origin: "*" }, // Allow all origins for testing
  });

  io.on("connection", (socket) => {
    console.log(`Client connected: ${socket.id}`);
    handlePcmFileUpload(socket);

    socket.on("disconnect", () => {
      console.log(`Client disconnected: ${socket.id}`);
    });
  });
}

// =============================
// 🎵 HANDLE PCM UPLOAD FUNCTION
// =============================
function handlePcmFileUpload(socket) {
  let writeStream = null;
  let filePath = "";
  let filename = "";

  // Start upload
  socket.on("start-upload", (data) => {
    if (!data || !data.filename) {
      return socket.emit("upload-response", {
        status: "error",
        message: "Filename is required",
      });
    }

    filename = data.filename.replace(/[^a-zA-Z0-9_.-]/g, "");

    if (!filename.toLowerCase().endsWith(".pcm")) {
      return socket.emit("upload-response", {
        status: "error",
        message: "Only .pcm files are allowed",
      });
    }

    const timestamp = Date.now();
    filePath = path.join(uploadDir, `${timestamp}_${filename}`);
    writeStream = fs.createWriteStream(filePath);

    console.log(`Receiving file: ${filePath}`);
  });

  // Receive chunks
  socket.on("pcm-chunk", (chunk) => {
    if (writeStream) {
      writeStream.write(Buffer.from(chunk));
      console.log(`Received chunk of size: ${chunk.length}`);
    }
  });

  // End upload
  socket.on("end-upload", () => {
    if (writeStream) {
      writeStream.end(() => {
        console.log(`File saved: ${filePath}`);
        socket.emit("upload-response", {
          status: "success",
          message: "Upload completed",
          savedAs: path.basename(filePath),
        });
      });
    } else {
      socket.emit("upload-response", {
        status: "error",
        message: "No file was being written",
      });
    }
  });

  // Optional: cleanup if upload is interrupted
  socket.on("disconnect", () => {
    if (writeStream) {
      writeStream.end();
      console.log("Upload interrupted. File stream closed.");
    }
  });
}
