import express from "express";
import dotenv from "dotenv";
import fetch from "node-fetch";
import { ImageAnnotatorClient } from "@google-cloud/vision";
import { User } from "../server.js";
import KillRecord from "../models/killRecordModel.js";

dotenv.config();

const router = express.Router();

/* ===============================
    🔑 Google Vision 初始化
================================*/
const client = new ImageAnnotatorClient({
  credentials: {
    client_email: process.env.GOOGLE_CLIENT_EMAIL,
    private_key: process.env.GOOGLE_PRIVATE_KEY,
  },
  projectId: "sharp-effort-353719",
});

/* ===============================
    🔍 名稱乾淨化（超強模糊）
================================*/
function cleanName(name) {
  if (!name) return "";
  return name
    .replace(/（.*?）/g, "")        // 中文括號
    .replace(/\(.*?\)/g, "")        // 英文括號
    .replace(/#\d+/g, "")           // #557 ID
    .replace(/[^\u4e00-\u9fa5a-zA-Z0-9]/g, "") // 符號移除
    .trim();
}

function isSamePlayer(a, b) {
  return cleanName(a) !== "" && cleanName(b) !== "" && cleanName(a) === cleanName(b);
}

/* ===============================
    🔫 武器名單
================================*/
const GUN_LIST = [
  "手槍","戰鬥手槍","重型手槍","小型衝鋒槍","削短型霰彈槍",
  "衝鋒槍","突擊步槍","卡賓步槍","射手步槍","雙管霰彈霰彈槍",
  "重型左輪手槍","突擊衝鋒槍","高階步槍","狙擊槍","煙火發射器",
  "0.5口徑手槍","戰鬥自衛衝鋒槍","衝鋒手槍","射手手槍","泵動式霰彈槍",
  "迷你衝鋒槍","古森柏衝鋒槍","衝鋒霰彈槍","射手步槍MKII","重型狙擊槍",
  "戰鬥機關槍MkII","特製卡賓步槍","穿甲手槍"
];

/* ===============================
    💰 計算設定
================================*/
const PRICE_KILL = 100000;
const PRICE_DEATH = 0;
const PRICE_MISTAKE = 0;

/* ===============================
    🧠 分析 API
================================*/
router.post("/analyze", async (req, res) => {
  try {
    const { imageUrl, uploaderName } = req.body;
    if (!imageUrl || !uploaderName) {
      return res.status(400).json({ error: "缺少必要參數" });
    }

    // 找上傳者
    const uploader = await User.findOne({ name: uploaderName });
    if (!uploader) {
      return res.status(400).json({ error: "找不到成員" });
    }

    /* ===============================
        ⭐ 下載圖片
    =================================*/
    const downloadUrl = imageUrl.replace(".webp", ".png");
    const imgRes = await fetch(downloadUrl);

    if (!imgRes.ok) {
      return res.status(400).json({ error: "無法下載圖片" });
    }

    const buffer = await imgRes.arrayBuffer();
    const base64Image = Buffer.from(buffer).toString("base64");

    /* ===============================
        ⭐ OCR
    =================================*/
    const [result] = await client.textDetection({
      image: { content: base64Image }
    });

    const raw = result.fullTextAnnotation?.text || "";
    console.log("🔍 OCR Raw:\n", raw);

    /* ===============================
        🔍 抓全部玩家 → 用來判斷友軍
    =================================*/
    const allUsers = await User.find({}, "name");

    /* ===============================
        🔍 分析擊殺紀錄（模糊名稱）
    =================================*/
    const lines = raw.split("\n").filter(
      (l) => l.includes("擊殺") && l.includes("使用")
    );

    let kills = 0, deaths = 0, mistakes = 0;
    const uploaderClean = cleanName(uploaderName);

    for (let line of lines) {
      const noSpace = line.replace(/\s/g, "");

      // 是否包含槍枝
      let gunHit = GUN_LIST.find(g => noSpace.includes(g));
      if (!gunHit) continue;

      const useIndex = noSpace.indexOf("使用");
      const killIndex = noSpace.indexOf("擊殺");
      if (useIndex === -1 || killIndex === -1) continue;

      const attacker = cleanName(noSpace.substring(0, useIndex));
      const victim = cleanName(noSpace.substring(killIndex + 2));

      const attackerIsUploader = isSamePlayer(attacker, uploaderClean);
      const victimIsUploader = isSamePlayer(victim, uploaderClean);

      if (!attackerIsUploader && !victimIsUploader) continue;

      // 判斷友軍（模糊）
      const victimIsFriendly = allUsers.some(u =>
        isSamePlayer(u.name, victim)
      );

      if (attackerIsUploader) {
        if (victimIsFriendly) mistakes++;
        else kills++;
      }

      if (victimIsUploader) {
        deaths++;
      }
    }

    /* ===============================
        💰 金額
    =================================*/
    const totalMoney =
      kills * PRICE_KILL +
      deaths * PRICE_DEATH +
      mistakes * PRICE_MISTAKE;

    const moneyText =
      totalMoney >= 10000 ? `${totalMoney / 10000}W` : `${totalMoney}`;

    /* ===============================
        ⭐ 寫入資料庫
    =================================*/
    const record = await KillRecord.create({
      uploader: uploaderName,
      guild: uploader.guild || "unknown",
      kills,
      deaths,
      mistakes,
      money: totalMoney,
    });

    /* ===============================
        ⭐ 回傳
    =================================*/
    return res.json({
      success: true,
      savedId: record._id,
      uploader: uploaderName,
      guild: uploader.guild,
      kills,
      deaths,
      mistakes,
      money: totalMoney,
      moneyText,
    });

  } catch (err) {
    console.error("❌ Vision Base64 OCR 錯誤：", err);
    return res.status(500).json({
      error: "Vision API 分析失敗",
      detail: err.message,
    });
  }
});

export default router;
