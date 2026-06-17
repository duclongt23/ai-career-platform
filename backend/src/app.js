const express = require("express");
const cors = require("cors");
const { globalRateLimit } = require("./middleware/rateLimit.middleware");

function createApp() {
  const app = express();

  app.use(
    cors({
      origin: [
        "http://localhost:5173",
        "https://ai-career-platform-pearl.vercel.app",
      ],
      credentials: true,
    })
  );
  app.use(express.json());
  app.use(globalRateLimit);

  app.get("/", (req, res) => {
    res.json({ message: "AI Career Guidance API is running" });
  });

  app.use("/api/auth", require("./routes/auth.routes"));
  app.use("/api/profile", require("./routes/profile.routes"));
  app.use("/api/careers", require("./routes/career.routes"));
  app.use("/api/riasec", require("./routes/riasec.routes"));
  app.use("/api/admin/core-quiz", require("./routes/adminCoreQuiz.routes"));
  app.use("/api/admin/elements", require("./routes/adminElements.routes"));
  app.use("/api/admin/users", require("./routes/adminUsers.routes"));

  return app;
}

module.exports = createApp;
