import express from "express";
import InjectionRecord from "../models/injectionModel.js";
import dotenv from "dotenv";
import fetch from "node-fetch";
import multer from "multer";
import { v2 as cloudinary } from "cloudinary";
import { CloudinaryStorage } from "multer-storage-cloudinary";

dotenv.config();
const router = express.Router();

const WEBHOOK = process.env.INJECTION_WEBHOOK;

/* =======================================
   🔧 Cloudinary 設定（不動 env）
======================================= */
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

/* =======================================
   📸 multer + cloudinary Storage
======================================= */
const storage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: "injection-records", // ← 固定資料夾名稱（不動 env）
    allowed_formats: ["jpg", "jpeg", "png", "webp"],
  },
});

const upload = multer({ storage });

/* =======================================
   🔥 POST /api/injection （含圖片）
======================================= */
router.post("/", upload.single("image"), async (req, res) => {
  try {
    // 取 token 使用者
    const user = req.user;
    if (!user || !user.name) {
      return res.status(401).json({
        success: false,
        message: "未登入或 token 無效",
      });
    }

    const { phoneLast5, count } = req.body;
    const name = user.name;

    if (!phoneLast5 || !count) {
      return res.status(400).json({
        success: false,
        message: "缺少必要欄位",
      });
    }

    // 🔥 強制必上傳圖片
    if (!req.file || !req.file.path) {
      return res.status(400).json({
        success: false,
        message: "請上傳截圖",
      });
    }

    const imageUrl = req.file.path; // Cloudinary 圖片網址

    /* =======================================
       🔥 檢查今日已領取數量
    ======================================== */
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const todayUsed = await InjectionRecord.aggregate([
      { $match: { name, createdAt: { $gte: todayStart } } },
      { $group: { _id: null, total: { $sum: "$count" } } },
    ]);

    const used = todayUsed.length ? todayUsed[0].total : 0;

    if (used + Number(count) > 2) {
      return res.status(400).json({
        success: false,
        message: `今日已領取 ${used} 支，最多只能領取 2 支`,
      });
    }

    /* =======================================
       🔥 寫入 MongoDB（多 imageUrl）
    ======================================== */
    const amount = Number(count) * 300000;

    const record = await InjectionRecord.create({
      name,
      phoneLast5,
      count,
      amount,
      imageUrl, // ← 新增一筆圖片網址
    });

    /* =======================================
       🔥 Discord Webhook（附圖片）
    ======================================== */
    if (WEBHOOK) {
      await fetch(WEBHOOK, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content:
            `📢 強心針領取通知\n` +
            `領取者：${name}\n` +
            `電話後五碼：${phoneLast5}\n` +
            `領取數量：${count}\n` +
            `今日累積：${used + Number(count)} / 2\n` +
            `總金額：${amount.toLocaleString()}`,
          embeds: [
            {
              title: "領取截圖",
              image: { url: imageUrl },
            },
          ],
        }),
      });
    }

    return res.json({ success: true, record });

  } catch (err) {
    console.error("injection error:", err);
    res.status(500).json({ success: false, message: "伺服器錯誤" });
  }
});

export default router;
