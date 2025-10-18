import express from "express"
import mongoose from "mongoose"
import cors from "cors"
import dotenv from "dotenv"
import rateLimit from "express-rate-limit"
import jwt from "jsonwebtoken"
import fetch from "node-fetch"
import Gun from "./models/gunModel.js"

dotenv.config()

const app = express()
const PORT = process.env.PORT || 3000
const DISCORD_WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL
const JWT_SECRET = process.env.JWT_SECRET || "guild_secret_key"

app.set("trust proxy", 1)

/* ------------------ 🌐 CORS 設定 ------------------ */
const allowedOrigins = [
  "http://localhost:5173",
  "https://gun-guild.netlify.app"
]

app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true)
      } else {
        callback(new Error("CORS 不允許的來源：" + origin))
      }
    },
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"]
  })
)

app.use(express.json())

/* ------------------ 🧱 防暴力登入 ------------------ */
const loginLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 5,
  message: { success: false, message: "嘗試次數過多，請 5 分鐘後再試" },
  standardHeaders: true,
  legacyHeaders: false
})

/* ------------------ 💾 MongoDB ------------------ */
mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => console.log("✅ 成功連線至 MongoDB Atlas"))
  .catch((err) => console.error("❌ MongoDB 連線失敗：", err))

/* ------------------ 👤 使用者資料結構 ------------------ */
const userSchema = new mongoose.Schema(
  {
    account: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    name: { type: String, required: true },
    guild: { type: String, required: true },
    role: {
      type: String,
      enum: ["leader", "officer", "member"],
      default: "member"
    }
  },
  { timestamps: true }
)

const User = mongoose.model("User", userSchema, "logins")

/* ------------------ 🔐 JWT 驗證中介層 ------------------ */
function verifyToken(req, res, next) {
  const authHeader = req.headers.authorization
  if (!authHeader) return res.status(401).json({ message: "未登入" })

  try {
    const token = authHeader.split(" ")[1]
    const decoded = jwt.verify(token, JWT_SECRET)
    req.user = decoded
    next()
  } catch (err) {
    return res.status(403).json({ message: "Token 無效或過期" })
  }
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ message: "未登入" })
    if (!roles.includes(req.user.role))
      return res.status(403).json({ message: "沒有權限" })
    next()
  }
}

/* ------------------ 📢 Discord 通知 ------------------ */
async function sendDiscordMessage(action, payload) {
  if (!DISCORD_WEBHOOK_URL) {
    console.warn("⚠️ 未設定 Discord Webhook URL，略過通知")
    return
  }

  try {
    const title = action === "borrow" ? "🔫 槍枝借出紀錄" : "♻️ 槍枝歸還紀錄"
    const color = action === "borrow" ? 0xfbbf24 : 0x22c55e
    const taiwanTime = new Date().toLocaleString("zh-TW", {
      timeZone: "Asia/Taipei",
      hour12: false
    })

    const body = {
      embeds: [
        {
          title,
          color,
          fields: [
            { name: "幫會", value: payload.guildName || "未知", inline: true },
            { name: "成員", value: payload.memberName || "未知", inline: true },
            { name: "槍枝", value: payload.gunName || "未知", inline: true },
            { name: "時間", value: taiwanTime, inline: false }
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
    } else {
      console.log("✅ 已發送 Discord 通知")
    }
  } catch (err) {
    console.error("❌ 無法發送 Discord 通知：", err)
  }
}

/* ------------------ 🔫 槍枝相關 API ------------------ */
app.get("/api/guns", async (req, res) => {
  try {
    const guns = await Gun.find().sort({ borrowTime: -1 })
    res.json(guns)
  } catch (err) {
    res.status(500).json({ error: "無法取得資料" })
  }
})

app.post("/api/borrow", async (req, res) => {
  try {
    const { guildName, memberName, gunName } = req.body
    if (!guildName || !memberName || !gunName)
      return res.status(400).json({ error: "缺少必要欄位" })

    const result = await Gun.findOneAndUpdate(
      { gunName, status: { $ne: "borrowed" } },
      {
        $set: {
          guildName,
          memberName,
          status: "borrowed",
          borrowTime: new Date(),
          returnTime: null
        }
      },
      { new: true, upsert: false }
    )

    if (!result)
      return res.status(400).json({ error: `槍枝「${gunName}」已被借出或不存在！` })

    sendDiscordMessage("borrow", { guildName, memberName, gunName })
    res.json({ success: true, message: "成功借出", data: result })
  } catch (err) {
    console.error("借槍失敗：", err)
    res.status(500).json({ error: "借槍失敗" })
  }
})

app.post("/api/return/:id", async (req, res) => {
  try {
    const record = await Gun.findById(req.params.id)
    if (!record) return res.status(404).json({ error: "找不到紀錄" })

    record.status = "returned"
    record.returnTime = new Date()
    await record.save()

    sendDiscordMessage("return", record)
    res.json(record)
  } catch (err) {
    console.error("歸還失敗：", err)
    res.status(500).json({ error: "歸還失敗" })
  }
})

/* ------------------ 👤 使用者登入與註冊 ------------------ */
app.post("/api/register", async (req, res) => {
  try {
    const { account, password, name, guild, role } = req.body
    if (!account || !password || !name)
      return res.status(400).json({ success: false, message: "缺少必要欄位" })

    const exists = await User.findOne({ account })
    if (exists)
      return res.status(409).json({ success: false, message: "此帳號已存在" })

    const newUser = await User.create({ account, password, name, guild, role })
    res.json({ success: true, user: newUser })
  } catch (err) {
    console.error("註冊失敗：", err)
    res.status(500).json({ success: false, message: "伺服器錯誤" })
  }
})

app.post("/api/login", loginLimiter, async (req, res) => {
  try {
    const { account, password } = req.body
    const user = await User.findOne({ account, password })
    if (!user)
      return res.status(401).json({ success: false, message: "帳號或密碼錯誤" })

    const token = jwt.sign(
      {
        id: user._id,
        name: user.name,
        guild: user.guild,
        role: user.role
      },
      JWT_SECRET,
      { expiresIn: "3h" }
    )

    res.json({
      success: true,
      message: "登入成功",
      token,
      user: { name: user.name, guild: user.guild, role: user.role }
    })
  } catch (err) {
    console.error("登入失敗：", err)
    res.status(500).json({ success: false, message: "伺服器錯誤" })
  }
})

/* ------------------ 📢 公告 API ------------------ */
app.post("/api/announcement", verifyToken, requireRole("leader", "officer"), async (req, res) => {
  try {
    const { content } = req.body
    if (!content) return res.status(400).json({ message: "缺少公告內容" })

    const dcBody = {
      content: `📢 ${content}`,
      username: `${req.user.name}（${req.user.role}）`,
      avatar_url: "https://cdn-icons-png.flaticon.com/512/4712/4712109.png"
    }

    const result = await fetch(DISCORD_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(dcBody)
    })

    if (!result.ok) throw new Error("Webhook 發送失敗")
    res.json({ success: true, message: "公告已成功發送到 Discord！" })
  } catch (err) {
    console.error("公告發送失敗：", err)
    res.status(500).json({ message: "公告發送失敗" })
  }
})

/* ------------------ 🚀 啟動伺服器 ------------------ */
app.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`))
