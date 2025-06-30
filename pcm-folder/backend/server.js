const express = require("express");
const http = require("http");
const fs = require("fs");
const fsp = fs.promises;
const path = require("path");
const { Server } = require("socket.io");
const axios = require("axios"); // ✅ Added axios

const uploadDir = path.join(__dirname, "uploads");

const app = express();
const server = http.createServer(app);

(async () => {
  try {
    await fsp.mkdir(uploadDir, { recursive: true });
    console.log("📂 Upload directory ready");

    connectSocketServer(server);

    server.listen(4000, () => {
      console.log("✅ Socket server running on http://localhost:4000");
    });
  } catch (err) {
    console.error("❌ Failed to initialize server:", err);
  }
})();

// ===============================
// 🔌 SOCKET CONNECTION HANDLER
// ===============================
function connectSocketServer(server) {
  const io = new Server(server, {
    cors: { origin: "*" },
  });

  io.on("connection", (socket) => {
    console.log(`🔗 Client connected: ${socket.id}`);
    handlePcmFileUpload(socket);

    socket.on("disconnect", () => {
      console.log(`❌ Client disconnected: ${socket.id}`);
    });
  });
}

// ===============================
// 🎵 PCM FILE UPLOAD HANDLER
// ===============================
function handlePcmFileUpload(socket) {
  let writeStream = null;
  let filePath = "";
  let filename = "";
  let isWriting = false;
  const queue = [];

  socket.on("start-upload", async (data) => {
    try {
      if (!data?.filename) {
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

      console.log(`📂 Receiving file: ${filePath}`);

      writeStream.on("error", (err) => {
        console.error("❌ Write stream error:", err);
        socket.emit("upload-response", {
          status: "error",
          message: "Failed to write file",
        });
      });

      writeStream.on("drain", () => {
        isWriting = false;
        processQueue();
      });
    } catch (err) {
      console.error("❌ Error in start-upload:", err);
      socket.emit("upload-response", {
        status: "error",
        message: "Internal server error",
      });
    }
  });

  socket.on("pcm-chunk", (chunk) => {
    queue.push(chunk);
    processQueue();
    console.log(`📨 Queued chunk (${chunk.length} bytes)`);
  });

  socket.on("end-upload", async () => {
    try {
      if (!writeStream) {
        return socket.emit("upload-response", {
          status: "error",
          message: "No file was being written",
        });
      }

      await new Promise((resolve) => {
        writeStream.end(() => {
          console.log(`✅ File saved: ${filePath}`);
          resolve();
        });
      });

      // ✅ API CALL: Send filePath to external server
      try {
        const response = await axios.post("http://localhost:5001/api/create", {
          filePath,
        });

        console.log("📡 API Response:", response.data);

        // ✅ Emit both upload and API status to client
        socket.emit("upload-response", {
          status: "success",
          message: "Upload completed and processed by API",
          savedAs: path.basename(filePath),
          apiResponse: response.data,
        });
      } catch (apiError) {
        console.error("❌ API Error:", apiError.message);

        socket.emit("upload-response", {
          status: "warning",
          message: "Upload successful, but API call failed",
          savedAs: path.basename(filePath),
          apiError: apiError.message,
        });
      }
    } catch (err) {
      console.error("❌ Error in end-upload:", err);
      socket.emit("upload-response", {
        status: "error",
        message: "Failed to finish upload",
      });
    }
  });

  socket.on("disconnect", async () => {
    if (writeStream) {
      await new Promise((resolve) => writeStream.end(resolve));
      console.log("⚠️ Upload interrupted. File stream closed.");
    }
  });

  function processQueue() {
    if (isWriting || !writeStream || queue.length === 0) return;

    const chunk = queue.shift();
    const canWrite = writeStream.write(Buffer.from(chunk));
    isWriting = !canWrite;

    if (!isWriting) processQueue(); // Continue writing next if not waiting
  }
}
