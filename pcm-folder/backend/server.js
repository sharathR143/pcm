// const express = require("express");
// const http = require("http");
// const fs = require("fs");
// const fsp = fs.promises;
// const path = require("path");
// const { Server } = require("socket.io");
// const axios = require("axios"); // ✅ Added axios

// const uploadDir = path.join(__dirname, "uploads");

// const app = express();
// const server = http.createServer(app);

// (async () => {
//   try {
//     await fsp.mkdir(uploadDir, { recursive: true });
//     console.log("📂 Upload directory ready");

//     connectSocketServer(server);

//     server.listen(4000, () => {
//       console.log("✅ Socket server running on http://localhost:4000");
//     });
//   } catch (err) {
//     console.error("❌ Failed to initialize server:", err);
//   }
// })();

// // ===============================
// // 🔌 SOCKET CONNECTION HANDLER
// // ===============================
// function connectSocketServer(server) {
//   const io = new Server(server, {
//     cors: { origin: "*" },
//   });

//   io.on("connection", (socket) => {
//     console.log(`🔗 Client connected: ${socket.id}`);
//     handlePcmFileUpload(socket);

//     socket.on("disconnect", () => {
//       console.log(`❌ Client disconnected: ${socket.id}`);
//     });
//   });
// }

// // ===============================
// // 🎵 PCM FILE UPLOAD HANDLER
// // ===============================
// function handlePcmFileUpload(socket) {
//   let writeStream = null;
//   let filePath = "";
//   let filename = "";
//   let isWriting = false;
//   const queue = [];

//   socket.on("start-upload", async (data) => {
//     try {
//       if (!data?.filename) {
//         return socket.emit("upload-response", {
//           status: "error",
//           message: "Filename is required",
//         });
//       }

//       filename = data.filename.replace(/[^a-zA-Z0-9_.-]/g, "");
//       if (!filename.toLowerCase().endsWith(".pcm")) {
//         return socket.emit("upload-response", {
//           status: "error",
//           message: "Only .pcm files are allowed",
//         });
//       }

//       const timestamp = Date.now();
//       filePath = path.join(uploadDir, `${timestamp}_${filename}`);
//       writeStream = fs.createWriteStream(filePath);

//       console.log(`📂 Receiving file: ${filePath}`);

//       writeStream.on("error", (err) => {
//         console.error("❌ Write stream error:", err);
//         socket.emit("upload-response", {
//           status: "error",
//           message: "Failed to write file",
//         });
//       });

//       writeStream.on("drain", () => {
//         isWriting = false;
//         processQueue();
//       });
//     } catch (err) {
//       console.error("❌ Error in start-upload:", err);
//       socket.emit("upload-response", {
//         status: "error",
//         message: "Internal server error",
//       });
//     }
//   });

//   socket.on("pcm-chunk", (chunk) => {
//     queue.push(chunk);
//     processQueue();
//     console.log(`📨 Queued chunk (${chunk.length} bytes)`);
//   });

//   socket.on("end-upload", async () => {
//     try {
//       if (!writeStream) {
//         return socket.emit("upload-response", {
//           status: "error",
//           message: "No file was being written",
//         });
//       }

//       await new Promise((resolve) => {
//         writeStream.end(() => {
//           console.log(`✅ File saved: ${filePath}`);
//           resolve();
//         });
//       });

//       // ✅ API CALL: Send filePath to external server
//       try {
//         const response = await axios.post("http://localhost:5001/api/create", {
//           filePath,
//         });

//         console.log("📡 API Response:", response.data);

//         // ✅ Emit both upload and API status to client
//         socket.emit("upload-response", {
//           status: "success",
//           message: "Upload completed and processed by API",
//           savedAs: path.basename(filePath),
//           apiResponse: response.data,
//         });
//       } catch (apiError) {
//         console.error("❌ API Error:", apiError.message);

//         socket.emit("upload-response", {
//           status: "warning",
//           message: "Upload successful, but API call failed",
//           savedAs: path.basename(filePath),
//           apiError: apiError.message,
//         });
//       }
//     } catch (err) {
//       console.error("❌ Error in end-upload:", err);
//       socket.emit("upload-response", {
//         status: "error",
//         message: "Failed to finish upload",
//       });
//     }
//   });

//   socket.on("disconnect", async () => {
//     if (writeStream) {
//       await new Promise((resolve) => writeStream.end(resolve));
//       console.log("⚠️ Upload interrupted. File stream closed.");
//     }
//   });

//   function processQueue() {
//     if (isWriting || !writeStream || queue.length === 0) return;

//     const chunk = queue.shift();
//     const canWrite = writeStream.write(Buffer.from(chunk));
//     isWriting = !canWrite;








const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const axios = require("axios");
const FormData = require("form-data");
const path = require("path");
const https = require("https");

const app = express();
const server = http.createServer(app);

// Start socket server
connectSocketServer(server);

server.listen(4002, () => {
  console.log("Socket server running on http://localhost:4002");
});

function connectSocketServer(server) {
  const io = new Server(server, {
    cors: { origin: "*" },
  });

  io.on("connection", (socket) => {
    console.log(`Client connected: ${socket.id}`);
    handleFileUpload(socket);

    socket.on("disconnect", () => {
      console.log(` Client disconnected: ${socket.id}`);
    });
  });
}

function handleFileUpload(socket) {
  let fileBuffer = [];
  let filename = "";
  let started = false;

  const cleanup = () => {
    fileBuffer = [];
    filename = "";
    started = false;
  };

  // "start" event: prepare to receive audio chunks
  socket.on("start", (data) => {
    if (!data?.filename) {
      return socket.emit("upload-response", {
        status: "error",
        message: "Filename is required",
      });
    }

    filename = data.filename.replace(/[^a-zA-Z0-9_.-]/g, "");
    const ext = path.extname(filename).toLowerCase();
    if (![".pcm", ".mp3", ".wav"].includes(ext)) {
      return socket.emit("upload-response", {
        status: "error",
        message: "Only .pcm, .mp3, or .wav files are allowed",
      });
    }

    fileBuffer = [];
    started = true;
    console.log(`Start: Ready to receive file: ${filename}`);
  });

  // Receive audio chunks only if started
  socket.on("audio_chunk", (chunk) => {
    if (started) {
      fileBuffer.push(Buffer.from(chunk));
    }
  });

  // "stop" event: process file, upload, predict, respond, cleanup
  socket.on("stop", async () => {
    if (!started || !filename || fileBuffer.length === 0) {
      socket.emit("upload-response", {
        status: "error",
        message: "No file data received or not started",
      });
      cleanup();
      socket.disconnect(true);
      return;
    }

    try {
      const completeBuffer = Buffer.concat(fileBuffer);
      const form = new FormData();
      form.append("file", completeBuffer, { filename });
      form.append("framework1", "tf");

      const agent = new https.Agent({ rejectUnauthorized: false });

      // Upload API
      const uploadResponse = await axios.post(
        "https://10.221.40.69:52005/uploadapi",
        form,
        {
          headers: form.getHeaders(),
          httpsAgent: agent,
        }
      );

      const uploadedFilename = uploadResponse.data?.filename;
      socket.emit("upload-response", {
        status: "success",
        filename: uploadedFilename,
      });

      // Prediction API
      const predictionResponse = await axios.get(
        `https://10.221.40.69:52005/predictapi/${uploadedFilename}/tf/Hindi`,
        { httpsAgent: agent }
      );

      socket.emit("prediction-response", {
        status: "success",
        intent: predictionResponse.data?.Intent,
        attribute: predictionResponse.data?.Attribute,
        thinQconnectStatus: predictionResponse.data?.thinQconnectStatus,
      });

      console.log(`File processed and prediction sent: ${uploadedFilename}`);
    } catch (err) {
      console.error("Error during upload/prediction:", err.message);
      socket.emit("upload-response", {
        status: "error",
        message: "Upload or prediction failed",
        error: err.message,
      });
    } finally {
      cleanup();
      socket.disconnect(true);
      console.log("🔌 Socket disconnected after stop");
    }
  });

  // disconnect
  socket.on("disconnect", () => {
    console.log("⚠️ Disconnected");
  });
}


//     if (!isWriting) processQueue(); // Continue writing next if not waiting
//   }
// }
