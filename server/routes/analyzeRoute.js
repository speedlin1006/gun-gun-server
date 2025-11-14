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
    🔍 移除「搶旗生存戰」亂碼尾巴
================================*/
function trimModeTag(text) {
  return text.replace(
    /[\(\[\{〈【『「][^)\]\}〉】』」]{0,20}搶旗生存戰[^)\]\}〉】』」]{0,20}[\)\]\}〉】』」]?/g,
    ""
  );
}

/* ===============================
    🔍 名稱乾淨化（超強模糊）
================================*/
function cleanName(name) {
  if (!name) return "";
  return name
    .replace(/（.*?）/g, "")
    .replace(/\(.*?\)/g, "")
    .replace(/#\d+/g, "")
    .replace(/[^\u4e00-\u9fa5a-zA-Z0-9]/g, "")
    .trim();
}

function isSamePlayer(a, b) {
  if (!a || !b) return false;
  return cleanName(a) === cleanName(b);
}

/* ===============================
    🔫 武器名單（含 OCR 常見錯字）
================================*/
const GUN_LIST = [
  "手槍","戰鬥手槍","重型手槍","小型衝鋒槍","削短型霰彈槍",
  "衝鋒槍","突擊步槍","卡賓步槍","射手步槍","雙管霰彈霰彈槍",
  "重型左輪手槍","突擊衝鋒槍","高階步槍","狙擊槍","煙火發射器",
  "0.5口徑手槍","戰鬥自衛衝鋒槍","衝鋒手槍","射手手槍","泵動式霰彈槍",
  "迷你衝鋒槍","古森柏衝鋒槍","衝鋒霰彈槍","射手步槍MKII","重型狙擊槍",

  // MKII 系列＋OCR常見錯字
  "戰鬥機關槍MKII",
  "戰鬥機關槍MkII",
  "戰鬥機關槍Mkii",
  "戰鬥機關槍MKIl",
  "戰鬥機關槍MkIl",

  "特製卡賓步槍",
  "穿甲手槍"
];

/* ===============================
    🧠 分析 API
================================*/
router.post("/analyze", async (req, res) => {
  try {
    const { imageUrl, uploaderName } = req.body;
    if (!imageUrl || !uploaderName) {
      return res.status(400).json({ error: "缺少必要參數" });
    }

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
        🔍 抓全部玩家（判斷友軍）
    =================================*/
    const allUsers = await User.find({}, "name");

    /* ===============================
        🔍 分析紀錄（強化版）
    =================================*/
    const lines = raw.split("\n").filter(l =>
      l.includes("使用") &&
      (
        l.includes("擊") ||
        l.includes("杀") ||
        l.includes("㑆") ||
        l.includes("㓥") ||
        l.includes("㯜")
      )
    );

    let kills = 0, deaths = 0, mistakes = 0;
    const uploaderClean = cleanName(uploaderName);

    for (let line of lines) {
      let row = line.replace(/\s/g, "");

      // ⭐ 先移除最後（搶旗生存戰）亂碼括號
      row = trimModeTag(row);

      // 找槍枝
      const gunHit = GUN_LIST.find(g => row.includes(g));
      if (!gunHit) continue;

      // 找擊殺關鍵字
      const killIndex = Math.max(
        row.indexOf("擊殺"),
        row.indexOf("杀"),
        row.indexOf("㑆"),
        row.indexOf("㓥"),
        row.indexOf("㯜")
      );

      const useIndex = row.indexOf("使用");
      if (useIndex === -1 || killIndex === -1) continue;

      const attackerRaw = row.substring(0, useIndex);
      const victimRaw = row.substring(killIndex + 2);

      const attacker = cleanName(attackerRaw);
      const victim = cleanName(victimRaw);

      const attackerIsUploader = isSamePlayer(attacker, uploaderClean);
      const victimIsUploader = isSamePlayer(victim, uploaderClean);

      if (!attackerIsUploader && !victimIsUploader) continue;

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
    const PRICE_KILL = 100000;
    const PRICE_DEATH = 0;
    const PRICE_MISTAKE = 0;

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
      guild: uploader.guild,
      kills,
      deaths,
      mistakes,
      money: totalMoney
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
      moneyText
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
