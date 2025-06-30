const express = require("express");
const app = express();
const PORT = 5001;

app.use(express.json());

app.post("/api/create", (req, res) => {
  const { filePath } = req.body;

  console.log("📥 Received filePath:", filePath);

  // Simulate processing (e.g., send back to client)
  setTimeout(() => {
    res.json({
      status: "processed",
      message: `Processing done for ${filePath}`,
    });
  }, 1000); // simulate delay
});

app.listen(PORT, () => {
  console.log(`🧠 API server listening on http://localhost:${PORT}`);
});
