import express from "express"
import mongoose from "mongoose"
import cors from "cors"
import dotenv from "dotenv"
import Gun from "./models/gunModel.js"

dotenv.config()

const app = express()
const PORT = process.env.PORT || 3000

// middleware
app.use(cors())
app.use(express.json())

// connect MongoDB
mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => console.log("連線至 MongoDB Atlas"))
  .catch((err) => console.error("MongoDB 連線失敗：", err))


const userSchema = new mongoose.Schema({
  account: { type: String, required: true, unique: true },
  password: { type: String, required: true }, 
  name: { type: String, required: true },
  guild: { type: String, required: false },
}, { timestamps: true })


const User = mongoose.model('User', userSchema, 'logins')



// 取得所有紀錄
app.get("/api/guns", async (req, res) => {
  try {
    const guns = await Gun.find().sort({ borrowTime: -1 })
    res.json(guns)
  } catch (err) {
    res.status(500).json({ error: "無法取得資料" })
  }
})

// 借出
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

    res.json(newRecord)
  } catch (err) {
    console.error("借槍失敗：", err)
    res.status(500).json({ error: "借槍失敗" })
  }
})

// 歸還
app.post("/api/return/:id", async (req, res) => {
  try {
    const record = await Gun.findById(req.params.id)
    if (!record) return res.status(404).json({ error: "找不到紀錄" })

    record.status = "returned"
    record.returnTime = new Date()
    await record.save()

    res.json(record)
  } catch (err) {
    console.error("歸還失敗：", err)
    res.status(500).json({ error: "歸還失敗" })
  }
})


app.post('/api/register', async (req, res) => {
  try {
    const { account, password, name } = req.body
    if (!account || !password || !name) {
      return res.status(400).json({ success: false, message: '缺少必要欄位' })
    }

    // 檢查是否已存在
    const exists = await User.findOne({ account })
    if (exists) {
      return res.status(409).json({ success: false, message: '此帳號已存在' })
    }

    const newUser = await User.create({ account, password, name })

    // 回傳時不要包含密碼
    const userSafe = {
      _id: newUser._id,
      account: newUser.account,
      name: newUser.name,
      guild: newUser.guild,
      createdAt: newUser.createdAt
    }

    res.json({ success: true, user: userSafe })
  } catch (err) {
    console.error('註冊失敗：', err)
    res.status(500).json({ success: false, message: '伺服器錯誤' })
  }
})


app.post('/api/login', async (req, res) => {
  try {
    const { account, password } = req.body
    if (!account || !password) {
      return res.status(400).json({ success: false, message: '缺少帳號或密碼' })
    }

    // 直接比對 account 與 password（注意：明文比對，僅供測試用）
    const user = await User.findOne({ account, password })

    if (!user) {
      return res.status(401).json({ success: false, message: '帳號或密碼錯誤' })
    }

    // 回傳時移除 password
    const userSafe = {
      _id: user._id,
      account: user.account,
      name: user.name,
      guild: user.guild,
      createdAt: user.createdAt
    }

    res.json({ success: true, user: userSafe })
  } catch (err) {
    console.error('登入失敗：', err)
    res.status(500).json({ success: false, message: '伺服器錯誤' })
  }
})

/* --------------------------------------------------------------- */

app.listen(PORT, () => console.log(` Server running on port ${PORT}`))
