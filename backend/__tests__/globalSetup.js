const mongoose = require("mongoose");
const fs = require("fs");
const path = require("path");

const FLAG_FILE = path.join(__dirname, ".mongo-available");

module.exports = async function () {
  const uri = process.env.MONGODB_TEST_URI || "mongodb://127.0.0.1:27017/ajui_test";
  try {
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 });
    await mongoose.disconnect();
    fs.writeFileSync(FLAG_FILE, "true");
  } catch {
    fs.writeFileSync(FLAG_FILE, "false");
  }
};
