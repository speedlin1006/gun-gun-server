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
    // ⭐ 若前端有帶月份，就用前端的
    const monthKey = req.query.month || (() => {
      const now = new Date();
      return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    })();

    const pool = await Pool.findOne({ month: monthKey });

    if (!pool) {
      return res.json({
        success: true,
        month: monthKey,
        amount: 0,
        contributors: [],
        message: "此月份沒有資料"
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
    // ⭐ 若有指定月份，優先使用指定的
    const monthKey = req.query.month || (() => {
      const now = new Date();
      return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    })();

    const pool = await Pool.findOne({ month: monthKey });

    if (!pool) {
      return res.json({ error: `${monthKey} 尚無獎池資料` });
    }

    if (pool.contributors.length === 0) {
      return res.json({ error: `${monthKey} 沒有貢獻者` });
    }

    const people = pool.contributors;
    const winner = people[Math.floor(Math.random() * people.length)];
    const drawTime = new Date().toLocaleString("zh-TW");

    // ⭐ 寫入抽獎結果（可覆蓋）
    await PoolResult.findOneAndUpdate(
      { month: monthKey },
      {
        month: monthKey,
        winner,
        amount: pool.amount,
        time: drawTime
      },
      { upsert: true, new: true }
    );

    return res.json({
      success: true,
      message: `${monthKey} 抽獎完成`,
      winner,
      amount: pool.amount,
      time: drawTime
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


/* ======================================================
   🏆 查詢本月中獎者（前端使用）
   GET /api/pool/winner
====================================================== */
router.get("/winner", async (req, res) => {
  try {
    const monthKey = req.query.month || (() => {
      const now = new Date();
      return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    })();

    const result = await PoolResult.findOne({ month: monthKey });

    if (!result) {
      return res.json({
        success: true,
        winner: "",
        time: "",
        message: "此月份尚未抽獎"
      });
    }

    return res.json({
      success: true,
      winner: result.winner,
      time: result.time
    });

  } catch (err) {
    res.status(500).json({ error: "無法取得中獎者資料", detail: err.message });
  }
});


export default router;
