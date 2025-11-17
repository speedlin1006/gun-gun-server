import express from "express";
import Pool from "../models/Pool.js";
import PoolResult from "../models/PoolResult.js";

const router = express.Router();

/* ======================================================
   📌 取得本月獎池資訊
   GET /api/pool/status
====================================================== */
router.get("/status", async (req, res) => {
  try {
    const now = new Date();
    const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

    const pool = await Pool.findOne({ month: monthKey });

    if (!pool) {
      return res.json({
        month: monthKey,
        amount: 0,
        contributors: [],
        message: "本月還沒有任何累積"
      });
    }

    return res.json({
      success: true,
      month: pool.month,
      amount: pool.amount,
      contributors: pool.contributors
    });
  } catch (err) {
    res.status(500).json({ error: "無法取得獎池資訊", detail: err.message });
  }
});


/* ======================================================
   🎰 手動抽獎（測試用）
   GET /api/pool/draw
====================================================== */
router.get("/draw", async (req, res) => {
  try {
    const now = new Date();
    const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

    const pool = await Pool.findOne({ month: monthKey });

    if (!pool) {
      return res.json({ error: "本月還沒有獎池資料" });
    }

    if (pool.contributors.length === 0) {
      return res.json({ error: "本月沒有貢獻者" });
    }

    const people = pool.contributors;
    const winner = people[Math.floor(Math.random() * people.length)];

    return res.json({
      success: true,
      winner,
      amount: pool.amount,
      contributors: people
    });
  } catch (err) {
    res.status(500).json({ error: "抽獎發生錯誤", detail: err.message });
  }
});


/* ======================================================
   📜 查詢歷史抽獎結果
   GET /api/pool/history
====================================================== */
router.get("/history", async (req, res) => {
  try {
    const results = await PoolResult.find().sort({ createdAt: -1 });

    res.json({
      success: true,
      history: results
    });
  } catch (err) {
    res.status(500).json({ error: "無法取得歷史資料", detail: err.message });
  }
});

export default router;
