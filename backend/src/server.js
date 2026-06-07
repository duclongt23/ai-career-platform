const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const connectDB = require("./db");
const { globalRateLimit } = require("./middleware/rateLimit.middleware");

dotenv.config();

const app = express();

app.use(cors());
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

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
