import mongoose from "mongoose";

const checkinSchema = new mongoose.Schema({
  account: String,
  name: String,

  yearMonth: String,       // ex: "2025-11"
  totalDays: Number,       // 當月天數
  checkedDays: Number,     // 已簽到天數
  dates: [String],         // ["2025-11-01", "2025-11-02"]

  completed: Boolean,      // 是否達成90%
  rewardSent: Boolean      // 是否已通知DC（避免重複）
}, { timestamps: true });

export default mongoose.model("CheckinRecord", checkinSchema, "checkin_records");
