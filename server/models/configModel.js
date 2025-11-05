import mongoose from "mongoose"

const configSchema = new mongoose.Schema({
  level: { type: String, default: "" }
})

export default mongoose.model("GuildConfig", configSchema)
