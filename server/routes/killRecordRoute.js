import express from "express";
import KillRecord from "../models/killRecordModel.js";

const router = express.Router();

// 取得所有擊殺紀錄
router.get("/killrecords", async (req, res) => {
  try {
    const list = await KillRecord.find().sort({ createdAt: -1 });
    res.json(list);
  } catch (err) {
    res.status(500).json({ error: "資料庫讀取失敗" });
  }
});

export default router;
