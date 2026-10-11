const path = require("path");
// Ensure dotenv finds .env in current or parent directory
require("dotenv").config({ path: path.resolve(__dirname, "../.env") });
require("dotenv").config(); // Fallback to current working directory

const app = require("./app");
const { connectDB } = require("./config/db");

const PORT = process.env.PORT || 4301;

const startServer = async () => {
  try {
    await connectDB();

    app.listen(PORT, () => {
      console.log(`=================================================`);
      console.log(`🚀 NexaLearn AI Backend is running with Supabase!`);
      console.log(`📡 Server Port: ${PORT}`);
      console.log(`🔗 API Base:    http://localhost:${PORT}/api`);
      console.log(`🩺 Health:      http://localhost:${PORT}/api/health`);
      console.log(`📚 Courses:     http://localhost:${PORT}/api/courses`);
      console.log(`🔑 Auth Test:   http://localhost:${PORT}/api/auth/test`);
      console.log(`=================================================`);
    });
  } catch (error) {
    console.error("❌ Server failed to start due to database error:");
    console.error(error.message);
    process.exit(1);
  }
};

startServer();
