const dotenv = require("dotenv");
const connectDB = require("./db");
const createApp = require("./app");

dotenv.config();

const app = createApp();

connectDB();

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
