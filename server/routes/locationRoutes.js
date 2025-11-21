// routes/locationRoutes.js
import express from "express"

const router = express.Router()

/* ======================================================
   ⭐ 白名單（account / 純名字 都可判斷）
====================================================== */
const skipGPSList = [
  "阿極",
  "ajie",
  "阿峰",
  "afeng",
  "純測試帳號 不要刪",
  "不曾想不曾想"
]

/* ======================================================
   📌 工具：清理遊戲名稱
   例如：休閒小築｜阿極 → 阿極
====================================================== */
function cleanName(rawName) {
  if (!rawName) return ""
  return rawName.replace(/^.*\｜/, "").trim()
}

/* ======================================================
   📍 判斷是否需要定位
====================================================== */
router.post("/shouldLocate", (req, res) => {
  const { account, name } = req.body

  if (!account && !name) {
    return res.status(400).json({ message: "缺少 account 或 name" })
  }

  const clean = cleanName(name)

  // ✔ 同時比對 (account) 或 (名稱)
  const isWhiteList =
    skipGPSList.includes(account) || skipGPSList.includes(clean)

  return res.json({ needLocate: !isWhiteList })
})

export default router
