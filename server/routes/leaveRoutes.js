import express from "express"
import Leave from "../models/leaveModel.js"

const router = express.Router()

// 🟢 新增請假紀錄
router.post("/", async (req, res) => {
  try {
    const { name, startDate, endDate, appliedAt, totalDays, reason } = req.body

    // 🔸 檢查必要欄位
    if (!name || !startDate || !endDate || !reason) {
      return res.status(400).json({ error: "缺少必要欄位（name / startDate / endDate / reason）" })
    }

    // 🔸 建立新紀錄
    const newLeave = new Leave({
      name,
      startDate,
      endDate,
      totalDays,
      reason,      // ✅ 寫入請假原因
      appliedAt
    })

    await newLeave.save()
    res.status(201).json({ message: "✅ 請假申請成功", data: newLeave })
  } catch (err) {
    console.error("❌ 新增請假紀錄錯誤：", err)
    res.status(500).json({ error: "伺服器錯誤" })
  }
})

// 🟡 查詢所有請假紀錄（管理者查看）
router.get("/", async (req, res) => {
  try {
    const leaves = await Leave.find().sort({ createdAt: -1 })

    // 🔸 格式化輸出
    const formatted = leaves.map(l => {
      const start = new Date(l.startDate)
      const end = new Date(l.endDate)
      const diff = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1
      return {
        name: l.name,
        startDate: l.startDate,
        endDate: l.endDate,
        reason: l.reason,       // ✅ 顯示請假原因
        appliedAt: l.appliedAt,
        totalDays: diff,
        createdAt: l.createdAt
      }
    })

    res.json(formatted)
  } catch (err) {
    console.error("❌ 查詢請假紀錄錯誤：", err)
    res.status(500).json({ error: "伺服器錯誤" })
  }
})

export default router
