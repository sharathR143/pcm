const fs = require("fs");

const sampleRate = 16000; // 16 kHz
const duration = 164.15; // ≈5MB of data
const frequency = 440; // A4 tone
const volume = 0.5;
const samples = Math.floor(sampleRate * duration);
const buffer = Buffer.alloc(samples * 2); // 2 bytes per sample

for (let i = 0; i < samples; i++) {
  const t = i / sampleRate;
  const sample = Math.round(
    volume * 32767 * Math.sin(2 * Math.PI * frequency * t)
  );
  buffer.writeInt16LE(sample, i * 2);
}

fs.writeFileSync("5mb_audio.pcm", buffer);
console.log("5mb_audio.pcm generated successfully!");
