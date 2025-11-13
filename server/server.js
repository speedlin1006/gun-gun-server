import express from "express"
import mongoose from "mongoose"
import cors from "cors"
import dotenv from "dotenv"
import rateLimit from "express-rate-limit"
import jwt from "jsonwebtoken"
import fetch from "node-fetch"
import Gun from "./models/gunModel.js"
import keepRecordRoutes from "./routes/keepRecordRoutes.js"
import configRoute from "./routes/configRoute.js"
import authRoutes from "./routes/auth.js"
import accountRoutes from "./routes/accountRoutes.mjs"
import leaveRoutes from "./routes/leaveRoutes.js"
import locationRoutes from './routes/locationRoutes.js'


// import User from "./models/userModel.js" 




dotenv.config()

const app = express()
const PORT = process.env.PORT || 3000
const DISCORD_WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL
const JWT_SECRET = process.env.JWT_SECRET || "guild_secret_key"

app.set("trust proxy", 1)

/* ------------------ 🌐 CORS 設定 ------------------ */
const allowedOrigins = [
  "http://localhost:5173",
  "https://gun-guild-gun.netlify.app"
]
app.use(
  cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) callback(null, true)
      else callback(new Error("CORS 不允許的來源：" + origin))
    },
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
   
    allowedHeaders: ["Content-Type", "Authorization", "X-Loc-Ticket"]
  })
)
app.use(express.json())
app.use(express.urlencoded({ extended: true }))  // ← 加這一行！



/* ------------------ 🧱 防暴力登入 ------------------ */
const loginLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 5,
  message: { success: false, message: "嘗試次數過多，請 5 分鐘後再試" },
  standardHeaders: true,
  legacyHeaders: false
})

/* ------------------ 💾 MongoDB 主資料庫 ------------------ */
mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => console.log("✅ 成功連線至主資料庫 MongoDB Atlas"))
  .catch((err) => console.error("❌ 主資料庫連線失敗：", err))

/* ------------------ 💾 第二資料庫（登入 IP） ------------------ */
const ipDB = mongoose.connection
ipDB.on("connected", () => console.log("✅ 已連線 IP 資料庫"))
ipDB.on("error", (err) => console.error("❌ IP 資料庫連線錯誤：", err))

/* ------------------ 💾 第三資料庫（登入位置） ------------------ */
const locDB = mongoose.connection
locDB.on("connected", () => console.log("✅ 已連線 Location 資料庫"))
locDB.on("error", (err) => console.error("❌ Location 資料庫連線錯誤：", err))

/* ------------------ 👤 使用者資料結構 ------------------ */
const userSchema = new mongoose.Schema(
  {
    account: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    name: { type: String, required: true },
    guild: { type: String, required: true },
    role: { type: String, enum: ["leader", "officer", "member"], default: "member" }
  },
  { timestamps: true }
)
const User = mongoose.model("User", userSchema, "logins")

/* ------------------ 🧾 IP 登入紀錄結構 ------------------ */
const ipSchema = new mongoose.Schema({
  account: String,
  ip: String,
  loginTime: { type: Date, default: Date.now }
})
const LoginIP = ipDB.model("LoginIP", ipSchema, "login_ips")

/* ------------------ 📍 位置紀錄結構 ------------------ */
const locationSchema = new mongoose.Schema({
  account: String,
  name: String,
  latitude: Number,
  longitude: Number,
  recordTime: { type: Date, default: Date.now }
})
const LoginLocation = locDB.model("LoginLocation", locationSchema, "login_locations")

/* ------------------ 🔐 JWT 驗證中介層 ------------------ */
function verifyToken(req, res, next) {
  const authHeader = req.headers.authorization
  if (!authHeader) return res.status(401).json({ message: "未登入" })
  try {
    const token = authHeader.split(" ")[1]
    req.user = jwt.verify(token, JWT_SECRET)
    next()
  } catch {
    res.status(403).json({ message: "Token 無效或過期" })
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
  if (!DISCORD_WEBHOOK_URL) return console.warn("⚠️ 未設定 Discord Webhook URL")
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
    await fetch(DISCORD_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    })
    console.log("✅ 已發送 Discord 通知")
  } catch (err) {
    console.error("❌ Discord 發送失敗：", err)
  }
}

/* ------------------ 🔫 槍枝 API ------------------ */
app.get("/api/guns", async (req, res) => {
  try {
    const guns = await Gun.find().sort({ borrowTime: -1 })
    res.json(guns)
  } catch {
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

/* ------------------ 👤 註冊與登入 ------------------ */
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

/* ------------------ 👤 登入：記錄 IP ------------------ */
app.post("/api/login", loginLimiter, async (req, res) => {
  try {
    const { account, password } = req.body
    const user = await User.findOne({ account, password })
    if (!user)
      return res.status(401).json({ success: false, message: "帳號或密碼錯誤" })

    // 抓真實 IP（支援 Render / Proxy）
    let ip = req.headers["x-forwarded-for"] || req.socket.remoteAddress || ""
    if (ip.includes(",")) ip = ip.split(",")[0].trim()

    // ✅ 儲存登入紀錄（IP）
    await LoginIP.create({
      account: user.account,
      name: user.name,
      ip,
      loginTime: new Date()
    })

    // ✅ 建立 JWT，加入 account
    const token = jwt.sign(
      {
        id: user._id,
        account: user.account, // 加這行讓前端能辨識帳號
        name: user.name,
        guild: user.guild,
        role: user.role
      },
      JWT_SECRET,
      { expiresIn: "3h" }
    )

    // ✅ 回傳 user 時一併附上 account
    res.json({
      success: true,
      message: "登入成功",
      token,
      ip,
      user: {
        account: user.account, // ✅ 關鍵！
        name: user.name,
        guild: user.guild,
        role: user.role
      }
    })
  } catch (err) {
    console.error("登入失敗：", err)
    res.status(500).json({ success: false, message: "伺服器錯誤" })
  }
})





/* ------------------ 📍 登入後上傳位置 ------------------ */
app.post("/api/location", async (req, res) => {
  try {
    const { account, name, latitude, longitude } = req.body
    if (!account || latitude == null || longitude == null)
      return res.status(400).json({ success: false, message: "缺少必要欄位" })

    const lat = Number(latitude)
    const lon = Number(longitude)
    if (isNaN(lat) || isNaN(lon))
      return res.status(400).json({ success: false, message: "座標格式錯誤" })

    // 若前端有提供 name 就用它，否則查資料庫
    let displayName = name
    if (!displayName) {
      const user = await User.findOne({ account })
      displayName = user ? user.name : "未知使用者"
    }

    await LoginLocation.create({
      account,
      name: displayName, // ✅ 寫入名稱
      latitude: lat,
      longitude: lon,
      recordTime: new Date()
    })

    res.json({ success: true, message: "✅ 已儲存位置", name: displayName })
  } catch (err) {
    console.error("位置儲存失敗：", err)
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


// 取得所有登入 IP 紀錄（由新到舊排序）
app.get("/api/login-ip", async (req, res) => {
  try {
    const records = await LoginIP.find().sort({ loginTime: -1 }) // 拿掉 .limit(1)
    res.json(records)
  } catch (err) {
    console.error("❌ 取得登入 IP 錯誤：", err)
    res.status(500).json({ error: "無法取得 IP 紀錄" })
  }
})

// 取得所有登入位置紀錄（由新到舊排序）
app.get("/api/login-location", async (req, res) => {
  try {
    const records = await LoginLocation.find().sort({ recordTime: -1 }) // 拿掉 .limit(1)
    res.json(records)
  } catch (err) {
    console.error("❌ 取得登入位置錯誤：", err)
    res.status(500).json({ error: "無法取得位置紀錄" })
  }
})

/* ------------------ 👑 使用者管理（管理員專用） ------------------ */

// 取得所有使用者
app.get("/api/users", async (req, res) => {
  try {
    const users = await User.find({}, "account name guild role").sort({ createdAt: -1 })
    res.json(users)
  } catch (err) {
    console.error("❌ 無法取得使用者資料：", err)
    res.status(500).json({ success: false, message: "伺服器錯誤" })
  }
})

// ✅ 更新使用者（名稱 / 幫會 / 階級）
app.put("/api/users/:id", async (req, res) => {
  try {
    const { name, guild, role } = req.body

    await User.findByIdAndUpdate(req.params.id, {
      name,
      guild,
      role  // ✅ 新增這一欄
    })

    res.json({ success: true, message: "更新成功" })
  } catch (err) {
    console.error("❌ 更新使用者錯誤：", err)
    res.status(500).json({ success: false, message: "更新失敗" })
  }
})


// 刪除使用者
app.delete("/api/users/:id", async (req, res) => {
  try {
    await User.findByIdAndDelete(req.params.id)
    res.json({ success: true, message: "已刪除使用者" })
  } catch (err) {
    console.error("❌ 刪除使用者錯誤：", err)
    res.status(500).json({ success: false, message: "刪除失敗" })
  }
})

// 新增使用者（管理員建立帳號）
app.post("/api/users", async (req, res) => {
  try {
    const { account, password, name, guild, role } = req.body

    if (!account || !password || !name || !guild) {
      return res.status(400).json({ success: false, message: "缺少必要欄位" })
    }

    // 檢查是否重複帳號
    const exists = await User.findOne({ account })
    if (exists) {
      return res.status(409).json({ success: false, message: "帳號已存在" })
    }

    // 建立新使用者
    const newUser = await User.create({
      account,
      password,
      name,
      guild,
      role: role || "member" // 預設為 member
    })

    res.json({ success: true, message: "✅ 新增成功", data: newUser })
  } catch (err) {
    console.error("❌ 新增使用者錯誤：", err)
    res.status(500).json({ success: false, message: "伺服器錯誤" })
  }
})



// ⚠️ 用不同名稱建立一次，不會覆蓋你原本的 User
const UserLookup =
  mongoose.models.UserLookup ||
  mongoose.model("UserLookup", new mongoose.Schema({}, { strict: false }), "logins")


app.get("/api/user/:account", async (req, res) => {
  try {
    const { account } = req.params

    // 使用新的模型名稱查詢，避免跟原本 User 衝突
    const user = await UserLookup.findOne({ account })

    if (!user) {
      return res.status(404).json({ message: "找不到該帳號" })
    }

    res.json({ password: user.password })
  } catch (err) {
    console.error("❌ 查詢密碼錯誤：", err)
    res.status(500).json({ message: "伺服器錯誤" })
  }
})


/* ------------------ 管理 API ------------------ */
app.use("/api/gun-keep", keepRecordRoutes)
app.use("/api/config", configRoute)
app.use("/api/auth", authRoutes)
app.use("/api/account", accountRoutes)
app.use("/api/leave", leaveRoutes)
app.use('/api/location', locationRoutes)





/* ------------------ 🚀 啟動伺服器 ------------------ */
app.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`))
