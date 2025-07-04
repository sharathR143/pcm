<!-- <template>
  <div>
    <h2>Upload .pcm File</h2>
    <input type="file" ref="fileInput" accept=".pcm" />
    <button @click="uploadFile">Upload</button>
    <p>{{ status }}</p>
  </div>
</template>

<script setup>
import { ref } from "vue";
import { io } from "socket.io-client";

const fileInput = ref(null);
const status = ref("");
const socket = io("http://localhost:4000");

const uploadFile = () => {
  const file = fileInput.value.files[0];
  if (!file || !file.name.endsWith(".pcm")) {
    status.value = "Only .pcm files are allowed.";
    return;
  }

  socket.emit("start-upload", { filename: file.name });

  const reader = new FileReader();
  reader.onload = () => {
    const CHUNK_SIZE = 1024;
    const buffer = new Uint8Array(reader.result);
    let offset = 0;

    const sendChunk = () => {
      const chunk = buffer.slice(offset, offset + CHUNK_SIZE);
      socket.emit("pcm-chunk", chunk);
      offset += CHUNK_SIZE;

      if (offset < buffer.length) {
        setTimeout(sendChunk, 10); // throttle slightly
      } else {
        socket.emit("end-upload");
      }
    };

    sendChunk();
  };
  reader.readAsArrayBuffer(file);

  socket.on("upload-response", (res) => {
    status.value = `${res.status.toUpperCase()}: ${res.message}`;
    if (res.status === "success") {
      console.log("File saved as:", res.savedAs);
    }
  });
};
</script>

<style scoped>
h2 {
  margin-bottom: 1rem;
}
button {
  margin-top: 0.5rem;
}
</style> -->

<template>
  <div>
    <h2>Upload .pcm File</h2>
    <input type="file" ref="fileInput" accept=".pcm" />
    <button @click="uploadFile">Upload</button>
    <p>{{ status }}</p>

    <div v-if="result">
      <h3>Upload Info</h3>
      <p><strong>Saved As:</strong> {{ result.savedAs }}</p>
      <p><strong>API Message:</strong> {{ result.apiResponse?.message }}</p>
      <p><strong>API File Path:</strong> {{ result.apiResponse?.filePath }}</p>
    </div>
  </div>
</template>

<script setup>
import { ref } from "vue";
import { io } from "socket.io-client";

const fileInput = ref(null);
const status = ref("");
const result = ref(null); // Store full server response
const socket = io("http://localhost:4000");

const uploadFile = () => {
  const file = fileInput.value.files[0];
  if (!file || !file.name.endsWith(".pcm")) {
    status.value = "Only .pcm files are allowed.";
    result.value = null;
    return;
  }

  socket.emit("start-upload", { filename: file.name });

  const reader = new FileReader();
  reader.onload = () => {
    const fileSize = file.size;
    let chunkSize = Math.floor(fileSize / 1000);
    chunkSize = Math.max(64 * 1024, Math.min(chunkSize, 1024 * 1024)); // 64KB–1MB

    console.log(`📁 File size: ${fileSize} bytes`);
    console.log(`📦 Chunk size: ${chunkSize} bytes`);
    console.log(`🔁 Estimated chunks: ${Math.ceil(fileSize / chunkSize)}`);

    const buffer = new Uint8Array(reader.result);
    let offset = 0;

    const sendChunk = () => {
      const chunk = buffer.slice(offset, offset + chunkSize);
      socket.emit("pcm-chunk", chunk);
      offset += chunkSize;

      if (offset < buffer.length) {
        setTimeout(sendChunk, 0); // throttle if needed
      } else {
        socket.emit("end-upload");
      }
    };

    sendChunk();
  };

  reader.readAsArrayBuffer(file);

  socket.on("upload-response", (res) => {
    result.value = res;
    status.value = `${res.status.toUpperCase()}: ${res.message}`;
    console.log("✅ Upload Response:", res);
  });
};
</script>

<style scoped>
h2 {
  margin-bottom: 1rem;
}
button {
  margin-top: 0.5rem;
}
</style>









<template>
  <div>
    <h2>Upload .pcm, .mp3, or .wav File</h2>
    <input type="file" ref="fileInput" accept=".pcm,.mp3,.wav" />
    <button @click="onUploadClick">Upload</button>
    <p>{{ status }}</p>

    <div v-if="uploadInfo">
      <h3>Upload Info</h3>
      <p><strong>Uploaded Filename:</strong> {{ uploadInfo.filename }}</p>
    </div>

    <div v-if="predictionInfo">
      <h3>Prediction Result</h3>
      <p><strong>Intent:</strong> {{ predictionInfo.Intent }}</p>
      <div
        v-if="
          predictionInfo.Attribute &&
          typeof predictionInfo.Attribute === 'object'
        "
      >
        <p><strong>Attribute:</strong></p>
        <ul>
          <li v-for="(val, key) in predictionInfo.Attribute" :key="key">
            {{ key }}: {{ val === null || val === undefined ? "null" : val }}
          </li>
        </ul>
      </div>
      <p>
        <strong>ThinQ Connect:</strong> {{ predictionInfo.thinQconnectStatus }}
      </p>
    </div>
  </div>
</template>

<script setup>
import { ref } from "vue";
import { io } from "socket.io-client";

const fileInput = ref(null);
const status = ref("");
const uploadInfo = ref(null);
const predictionInfo = ref(null);

let socket = null;

// --- Upload + Prediction Button Handler ---
function onUploadClick() {
  if (!fileInput.value || !fileInput.value.files.length) {
    status.value = "❌ Please select a valid file.";
    return;
  }
  connectSocket(); // Initiates socket + upload
}

// --- Socket Communication ---
function connectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }

  socket = io("http://10.221.43.61:4002");

  socket.on("connect", () => {
    console.log("Socket connected");
    start();
  });

  socket.on("upload-response", handleUploadResponse);
  socket.on("prediction-response", handlePredictionResponse);
  socket.on("error", handleSocketError);
  socket.on("disconnect", () => {
    console.log("🔌 Socket disconnected");
  });
}

// --- Upload Start Logic ---
function start() {
  const file = fileInput.value?.files[0];
  if (!file) {
    status.value = "❌ No file selected.";
    return stop();
  }

  const allowedExt = [".pcm", ".mp3", ".wav"];
  const ext = file.name.slice(file.name.lastIndexOf(".")).toLowerCase();
  if (!allowedExt.includes(ext)) {
    status.value = "❌ Only .pcm, .mp3, or .wav files are allowed.";
    uploadInfo.value = null;
    predictionInfo.value = null;
    return stop();
  }

  status.value = "📤 Uploading...";
  uploadInfo.value = null;
  predictionInfo.value = null;

  socket.emit("start", { filename: file.name });

  const reader = new FileReader();
  reader.onload = () => {
    const buffer = new Uint8Array(reader.result);
    const fileSize = file.size;
    let chunkSize = Math.floor(fileSize / 1000);
    chunkSize = Math.max(64 * 1024, Math.min(chunkSize, 1024 * 1024)); // 64KB–1MB

    let offset = 0;
    const sendChunk = () => {
      if (!socket) return;
      const chunk = buffer.slice(offset, offset + chunkSize);
      socket.emit("audio_chunk", chunk);
      offset += chunkSize;

      if (offset < buffer.length) {
        setTimeout(sendChunk, 1); // Give event loop room
      } else {
        socket.emit("stop");
      }
    };
    sendChunk();
  };

  reader.onerror = () => {
    status.value = "❌ Failed to read file.";
    stop();
  };

  reader.readAsArrayBuffer(file);
}

// --- Response Handlers ---
function handleUploadResponse(res) {
  if (res.status === "success" && res.filename) {
    uploadInfo.value = { filename: res.filename };
    status.value = "✅ Upload completed!";
  } else {
    status.value = `⚠️ Upload failed: ${res.message || res.error}`;
  }
}

function handlePredictionResponse(res) {
  if (res.status === "success") {
    predictionInfo.value = {
      Intent: res.intent,
      Attribute: res.attribute,
      thinQconnectStatus: res.thinQconnectStatus,
    };
    status.value = "🔮 Prediction successful!";
  } else {
    predictionInfo.value = null;
    status.value = `❌ Prediction failed: ${res.message || res.error}`;
  }
  stop();
}

function handleSocketError(err) {
  console.error("Socket error:", err);
  status.value = "❌ Socket error occurred.";
  stop();
}

// --- Disconnect Logic ---
function stop() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}
</script>

<style scoped>
h2 {
  margin-bottom: 1rem;
}
button {
  margin-top: 0.5rem;
}
ul {
  list-style: none;
  padding-left: 0;
  margin-left: 0;
}
</style>

