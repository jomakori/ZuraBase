import express from "express";
const app = express();

// Track whether the dev server is ready
let devServerReady = false;

// Set dev server as ready after a short delay to ensure Vite has initialized
setTimeout(() => {
  devServerReady = true;
}, 3000);

// Healthcheck endpoint
app.get("/health", (req, res) => {
  res.setHeader("Content-Type", "application/json");
  if (!devServerReady) {
    res.status(503).json({
      status: "unhealthy",
      error: "Dev server not fully initialized",
    });
    return;
  }
  res.status(200).json({ status: "healthy" });
});

// Start the healthcheck server
const port = process.env.PORT || 8181;
app.listen(port, () => {
  console.log(`Healthcheck server running on port ${port}`);
});
