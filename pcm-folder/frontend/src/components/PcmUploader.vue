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
