import express from "express";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();

// Get UI_ENDPOINT for CORS
const uiEndpoint = process.env.UI_ENDPOINT || "*";
console.log(`[Server] Using UI_ENDPOINT for CORS: ${uiEndpoint}`);

// Get API endpoint
const apiEndpoint = process.env.API_ENDPOINT;
console.log(`[Server] Using API_ENDPOINT: ${apiEndpoint}`);

// Request logging middleware
app.use((req, res, next) => {
  console.log(`[Server] ${req.method} ${req.url}`);
  next();
});

// CORS middleware
app.use((req, res, next) => {
  console.log(
    `[Server] Setting CORS headers for ${req.method} ${req.url} from ${req.ip}`
  );

  // Allow all origins for testing
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.header("Access-Control-Allow-Credentials", "true");

  if (req.method === "OPTIONS") {
    console.log(`[Server] Handling OPTIONS request for ${req.url}`);
    return res.status(200).end();
  }

  next();
});

// Simple health check endpoint
app.get("/health", (req, res) => {
  res.status(200).json({ status: "healthy" });
});

// Determine the static directory
const staticDir = process.env.NODE_ENV === "production" ? "dist" : "public";
if (fs.existsSync(path.join(__dirname, staticDir))) {
  app.use(express.static(path.join(__dirname, staticDir)));
  console.log(`[Server] Serving static files from ${staticDir}`);
} else {
  console.log(
    `[Server] Static directory ${staticDir} not found, serving from root`
  );
  app.use(express.static(__dirname));
}

// Handle specific routes for the SPA
app.get("/", serveIndex);
app.get("/notes", serveIndex);
app.get("/planner", serveIndex);
app.get("/notes/:id", serveIndex);
app.get("/planner/:id", serveIndex);

// Function to serve the index.html file
function serveIndex(req, res) {
  const indexPath =
    process.env.NODE_ENV === "production"
      ? path.join(__dirname, "dist", "index.html")
      : path.join(__dirname, "index.html");

  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.status(404).send("Index file not found");
  }
}

// Start the server
const port = process.env.PORT || 8181;
app.listen(port, "0.0.0.0", () => {
  console.log(`[Server] Server running on port ${port}`);
  console.log(`[Server] Environment: ${process.env.NODE_ENV || "development"}`);
  console.log(`[Server] Listening on all interfaces (0.0.0.0)`);

  // Check for required environment variables
  if (!apiEndpoint) {
    console.error(
      "[Server] ERROR: API_ENDPOINT environment variable is not set"
    );
    console.error("[Server] Application may not function correctly");
  }

  if (!uiEndpoint || uiEndpoint === "*") {
    console.warn(
      "[Server] WARNING: UI_ENDPOINT not set or set to '*'. This may cause CORS issues."
    );
  }
});

// Add a simple route to test if the server is responding
app.get("/test", (req, res) => {
  console.log(`[Server] Test endpoint called from ${req.ip}`);
  try {
    res.status(200).send("Server is responding");
    console.log("[Server] Test response sent successfully");
  } catch (error) {
    console.error("[Server] Error sending test response:", error);
  }
});

// Add a simple route that returns JSON
app.get("/api/test", (req, res) => {
  console.log(`[Server] API test endpoint called from ${req.ip}`);
  try {
    res.status(200).json({ status: "ok", message: "API is responding" });
    console.log("[Server] API test response sent successfully");
  } catch (error) {
    console.error("[Server] Error sending API test response:", error);
  }
});

// Add a simple plain text response route
app.get("/plain", (req, res) => {
  console.log(`[Server] Plain text endpoint called from ${req.ip}`);
  try {
    // Set minimal headers
    res.writeHead(200, {
      "Content-Type": "text/plain",
      "Content-Length": 19,
    });
    // Send response and end
    res.end("Plain text response");
    console.log("[Server] Plain text response sent successfully");
  } catch (error) {
    console.error("[Server] Error sending plain text response:", error);
  }
});

// Add a super simple endpoint
app.get("/hello", (req, res) => {
  console.log(`[Server] Hello endpoint called from ${req.ip}`);
  res.end("Hello");
  console.log("[Server] Hello response sent");
});
