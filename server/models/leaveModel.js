import mongoose from "mongoose"

const leaveSchema = new mongoose.Schema(
  {
    name: String,
    startDate: String,
    endDate: String,
    totalDays: Number,
    reason: String,
    appliedAt: String
  },
  { timestamps: true } // 
)

export default mongoose.model("Leave", leaveSchema)
