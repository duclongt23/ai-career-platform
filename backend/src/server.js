const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const connectDB = require("./db");
const { globalRateLimit } = require("./middleware/rateLimit.middleware");

dotenv.config();

const app = express();

app.use(cors({
  origin: [
    "http://localhost:5173",
    "https://ai-career-platform-pearl.vercel.app"
  ],
  credentials: true
}));
app.use(express.json());
app.use(globalRateLimit);

connectDB();

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

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
