import express from "express"
import mongoose from "mongoose"
import cors from "cors"
import dotenv from "dotenv"
import rateLimit from "express-rate-limit"   
import Gun from "./models/gunModel.js"

dotenv.config()

const app = express()
const PORT = process.env.PORT || 3000
const DISCORD_WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL

/* ------------------ 🔒 防暴力登入攻擊 ------------------ */
const loginLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 分鐘
  max: 5, // 同 IP 最多嘗試 5 次
  message: { success: false, message: "嘗試次數過多，請 5 分鐘後再試" },
  standardHeaders: true,
  legacyHeaders: false,
})

/* ------------------ 🌐 CORS 設定 ------------------ */
const allowedOrigins = [
  "http://localhost:5173",        // 本地開發
  "https://gun-guild.netlify.app" // 正式上線網址
]

app.use(cors({
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true)
    } else {
      callback(new Error("CORS 不允許的來源：" + origin))
    }
  },
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
}))


/* ------------------ 🧩 MongoDB 連線 ------------------ */
mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => console.log("✅ 成功連線至 MongoDB Atlas"))
  .catch((err) => console.error("❌ MongoDB 連線失敗：", err))

/* ------------------ 👤 使用者資料結構 ------------------ */
const userSchema = new mongoose.Schema({
  account: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  name: { type: String, required: true },
  guild: { type: String, required: false },
}, { timestamps: true })

const User = mongoose.model("User", userSchema, "logins")

/* ------------------ 🪶 Discord Webhook 通知 ------------------ */
async function sendDiscordMessage(action, payload) {
  if (!DISCORD_WEBHOOK_URL) {
    console.warn("⚠️ 未設定 Discord Webhook URL，略過通知")
    return
  }

  try {
    const title = action === "borrow" ? "🔫 槍枝借出紀錄" : "♻️ 槍枝歸還紀錄"
    const color = action === "borrow" ? 0xfbbf24 : 0x22c55e

    const body = {
      embeds: [
        {
          title,
          color,
          fields: [
            { name: "幫會", value: payload.guildName || "未知", inline: true },
            { name: "成員", value: payload.memberName || "未知", inline: true },
            { name: "槍枝", value: payload.gunName || "未知", inline: true },
            { name: "時間", value: payload.time || new Date().toLocaleString("zh-TW"), inline: false }
          ],
          footer: { text: "槍枝借還系統自動通知" },
          timestamp: new Date().toISOString()
        }
      ]
    }

    const res = await fetch(DISCORD_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    })

    if (!res.ok) {
      const errTxt = await res.text()
      console.error("Discord webhook 發送失敗：", errTxt)
    }
  } catch (err) {
    console.error("無法發送 Discord 通知：", err)
  }
}

/* ------------------ 📡 API 區塊 ------------------ */

// 槍枝紀錄
app.get("/api/guns", async (req, res) => {
  try {
    const guns = await Gun.find().sort({ borrowTime: -1 })
    res.json(guns)
  } catch (err) {
    res.status(500).json({ error: "無法取得資料" })
  }
})

// 借出槍枝
app.post("/api/borrow", async (req, res) => {
  try {
    const { guildName, memberName, gunName } = req.body
    if (!guildName || !memberName || !gunName) {
      return res.status(400).json({ error: "缺少必要欄位" })
    }

    const newRecord = await Gun.create({
      guildName,
      memberName,
      gunName,
      status: "borrowed",
      borrowTime: new Date(),
    })

    sendDiscordMessage("borrow", {
      guildName,
      memberName,
      gunName,
      time: newRecord.borrowTime.toLocaleString("zh-TW")
    })

    res.json(newRecord)
  } catch (err) {
    console.error("借槍失敗：", err)
    res.status(500).json({ error: "借槍失敗" })
  }
})

// 歸還槍枝
app.post("/api/return/:id", async (req, res) => {
  try {
    const record = await Gun.findById(req.params.id)
    if (!record) return res.status(404).json({ error: "找不到紀錄" })

    record.status = "returned"
    record.returnTime = new Date()
    await record.save()

    sendDiscordMessage("return", {
      guildName: record.guildName,
      memberName: record.memberName,
      gunName: record.gunName,
      time: record.returnTime.toLocaleString("zh-TW")
    })

    res.json(record)
  } catch (err) {
    console.error("歸還失敗：", err)
    res.status(500).json({ error: "歸還失敗" })
  }
})

/* ------------------ 👤 使用者帳號 ------------------ */

// 註冊
app.post("/api/register", async (req, res) => {
  try {
    const { account, password, name } = req.body
    if (!account || !password || !name)
      return res.status(400).json({ success: false, message: "缺少必要欄位" })

    const exists = await User.findOne({ account })
    if (exists)
      return res.status(409).json({ success: false, message: "此帳號已存在" })

    const newUser = await User.create({ account, password, name })
    const userSafe = {
      _id: newUser._id,
      account: newUser.account,
      name: newUser.name,
      guild: newUser.guild,
      createdAt: newUser.createdAt
    }

    res.json({ success: true, user: userSafe })
  } catch (err) {
    console.error("註冊失敗：", err)
    res.status(500).json({ success: false, message: "伺服器錯誤" })
  }
})

// 登入 (防暴力登入)
app.post("/api/login", loginLimiter, async (req, res) => {
  try {
    const { account, password } = req.body
    if (!account || !password)
      return res.status(400).json({ success: false, message: "缺少帳號或密碼" })

    const user = await User.findOne({ account, password })
    if (!user)
      return res.status(401).json({ success: false, message: "帳號或密碼錯誤" })

    const userSafe = {
      _id: user._id,
      account: user.account,
      name: user.name,
      guild: user.guild,
      createdAt: user.createdAt
    }

    res.json({ success: true, user: userSafe })
  } catch (err) {
    console.error("登入失敗：", err)
    res.status(500).json({ success: false, message: "伺服器錯誤" })
  }
})

/* ------------------ 🚀 啟動伺服器 ------------------ */
app.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`))
