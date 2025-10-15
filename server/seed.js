import dotenv from "dotenv";
dotenv.config();

import mongoose from "mongoose";
import Gun from "./models/gunModel.js";

const URI = process.env.MONGODB_URI;

async function main() {
  await mongoose.connect(URI);
  console.log("Connected to MongoDB for seeding");

  const seedData = [
    {
      guildName: "休閒幫會",
      memberName: "阿極",
      gunName: "M4A1",
      status: "borrowed",
      borrowTime: new Date("2025-10-15T11:00:00Z"),
      returnTime: null
    },
    {
      guildName: "休閒幫會",
      memberName: "測試小A",
      gunName: "Glock 17",
      status: "borrowed",
      borrowTime: new Date(),
      returnTime: null
    },
    {
      guildName: "另一幫會",
      memberName: "小B",
      gunName: "MP5",
      status: "returned",
      borrowTime: new Date("2025-10-14T08:00:00Z"),
      returnTime: new Date("2025-10-15T10:00:00Z")
    }
  ];

  // 你可以選擇先刪除現有資料（小心使用）
  // await Gun.deleteMany({});

  const res = await Gun.insertMany(seedData);
  console.log("Inserted:", res.length, "documents");
  await mongoose.disconnect();
  console.log("Disconnected.");
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
