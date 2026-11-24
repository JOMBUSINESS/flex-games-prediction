
require("dotenv").config();

const path = require("path");
const http = require("http");
const express = require("express");
const session = require("express-session");
const helmet = require("helmet");
const { Pool } = require("pg");
const { Server } = require("socket.io");
const authRoutes = require("./routes/auth");
const adminRoutes = require("./routes/admin");

const app = express();
const server = http.createServer(app);

const PORT = process.env.PORT || 3000;
const isProduction = process.env.NODE_ENV === "production";

if (isProduction && !process.env.SESSION_SECRET) {
  throw new Error("SESSION_SECRET must be configured in production.");
}

if (isProduction && !process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL must be configured in production.");
}

// PostgreSQL connection
const pool = process.env.DATABASE_URL
  ? new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: isProduction
        ? { rejectUnauthorized: false }
        : undefined
    })
  : null;

if (pool) {
  pool.on("error", (error) => {
    console.error("Unexpected database error:", error);
  });
} else {
  console.warn("DATABASE_URL is not set. Database features are unavailable.");
}

// Make database available to future route modules
app.locals.db = pool;

// Security and request middleware
app.disable("x-powered-by");
app.use(helmet({
  contentSecurityPolicy: false
}));

app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));

// Session configuration
app.use(session({
  name: "flex.sid",
  secret: process.env.SESSION_SECRET || "development-only-change-this-secret",
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: isProduction,
    sameSite: "lax",
    maxAge: 1000 * 60 * 60 * 24
  }
}));

// Socket.IO
const io = new Server(server);

app.locals.io = io;

io.on("connection", (socket) => {
  console.log("A user connected:", socket.id);

  socket.on("disconnect", () => {
    console.log("A user disconnected:", socket.id);
  });
});

// Static website files
const publicDirectory = path.join(__dirname, "public");

app.use(express.static(publicDirectory));

// Health check
app.get("/api/health", async (req, res) => {
  let database = "not_configured";

  if (pool) {
    try {
      await pool.query("SELECT 1");
      database = "connected";
    } catch (error) {
      console.error("Database health check failed:", error);
      database = "error";
    }
  }

  res.status(database === "error" ? 503 : 200).json({
    success: true,
    application: "FLEX GAMES PREDICTION",
    status: "running",
    database
  });
});

// Separate admin entry point
app.get("/admin", (req, res) => {
  res.sendFile(path.join(publicDirectory, "admin", "index.html"));
});

app.get("/admin/*path", (req, res) => {
  res.sendFile(path.join(publicDirectory, "admin", "index.html"));
});

// API placeholder
app.get("/api", (req, res) => {
  res.json({
    success: true,
    message: "FLEX GAMES PREDICTION API is running."
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: "The requested resource was not found."
  });
});

// Error handler
app.use((error, req, res, next) => {
  console.error(error);

  res.status(error.status || 500).json({
    success: false,
    message: "An unexpected server error occurred."
  });
});

// Start server
server.listen(PORT, () => {
  console.log(`FLEX GAMES PREDICTION running on port ${PORT}`);
});

// Graceful shutdown
async function shutdown() {
  console.log("Shutting down server...");

  server.close(async () => {
    if (pool) {
      await pool.end();
    }

    process.exit(0);
  });
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
