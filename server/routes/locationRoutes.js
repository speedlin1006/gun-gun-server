// routes/locationRoutes.js
import express from "express"
import Location from "../models/locationModel.js"

const router = express.Router()

// ✅ 白名單（不用定位）
const skipGPSList = ["阿極", "阿峰", "純測試帳號 不要刪"]

/* ======================================================
   📍 判斷是否需要定位
   ====================================================== */
router.post("/shouldLocate", (req, res) => {
  const { name } = req.body
  if (!name) return res.status(400).json({ message: "缺少名稱" })

  const needLocate = !skipGPSList.includes(name)
  res.json({ needLocate })
})

/* ======================================================
   ✅ 新增定位紀錄（只存名稱 + 經緯度 + 時間）
   ====================================================== */
router.post("/", async (req, res) => {
  try {
    const { name, latitude, longitude } = req.body

    if (!name) {
      return res.status(400).json({ success: false, message: "缺少名稱" })
    }

    // 若未開啟定位，就不要擋，緯經度給 null
    const record = await Location.create({
      name,
      latitude: latitude || null,
      longitude: longitude || null,
      recordTime: new Date()
    })

    res.json({ success: true, record })
  } catch (err) {
    console.error("❌ 新增位置紀錄錯誤：", err)
    res.status(500).json({ success: false, message: "伺服器錯誤" })
  }
})

export default router
