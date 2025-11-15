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
================================ */
const client = new ImageAnnotatorClient({
  credentials: {
    client_email: process.env.GOOGLE_CLIENT_EMAIL,
    private_key: process.env.GOOGLE_PRIVATE_KEY,
  },
  projectId: "sharp-effort-353719",
});

/* ===============================
    🔍 移除「搶旗生存戰」亂碼尾巴
================================ */
function trimModeTag(text) {
  return text.replace(
    /[\(\[\{〈【『「][^)\]\}〉】』」]{0,20}搶旗生存戰[^)\]\}〉】』」]{0,20}[\)\]\}〉】』」]?/g,
    ""
  );
}

/* ===============================
    🔍 名稱乾淨化（超強模糊）
================================ */
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
    🔫 武器名單
================================ */
const GUN_LIST = [
  "手槍","戰鬥手槍","重型手槍","小型衝鋒槍","削短型霰彈槍",
  "衝鋒槍","突擊步槍","卡賓步槍","射手步槍","雙管霰彈霰彈槍",
  "重型左輪手槍","突擊衝鋒槍","高階步槍","狙擊槍","煙火發射器",
  "0.5口徑手槍","戰鬥自衛衝鋒槍","衝鋒手槍","射手手槍","泵動式霰彈槍",
  "迷你衝鋒槍","古森柏衝鋒槍","衝鋒霰彈槍","射手步槍MKII","重型狙擊槍",
  "戰鬥機關槍MKII","戰鬥機關槍MkII","戰鬥機關槍Mkii","戰鬥機關槍MKIl","戰鬥機關槍MkIl",
  "特製卡賓步槍",
  "穿甲手槍"
];

/* ===============================
    🧹 全形 → 半形
================================ */
function toHalfWidth(str) {
  return str.replace(/[\uff01-\uff5e]/g, ch =>
    String.fromCharCode(ch.charCodeAt(0) - 0xfee0)
  ).replace(/\u3000/g, " ");
}

/* ===============================
    🗓 日期修正（各種怪符號 → 正常格式）
================================ */
function normalizeDateString(str) {
  if (!str) return "";
  str = toHalfWidth(str);
  str = str.replace(/[^0-9\/: ]/g, "");
  str = str.replace(/\/+/g, "/");
  return str.trim();
}

/* ===============================
    🧠 /analyze API
================================ */
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

    /* 下載圖片 */
    const downloadUrl = imageUrl.replace(".webp", ".png");
    const imgRes = await fetch(downloadUrl);
    if (!imgRes.ok) {
      return res.status(400).json({ error: "無法下載圖片" });
    }

    const buffer = await imgRes.arrayBuffer();
    const base64Image = Buffer.from(buffer).toString("base64");

    /* OCR */
    const [ocrResult] = await client.textDetection({
      image: { content: base64Image }
    });

    const raw = ocrResult.fullTextAnnotation?.text || "";
    console.log("🔍 OCR Raw:\n", raw);

    /* ==================================
        📅 日期行統一處理
    ===================================*/
    const lines = raw.split("\n");

    const dateLines = lines
      .map(l => normalizeDateString(l))
      .filter(l => /\d{4}\/\d{1,2}\/\d{1,2}/.test(l));

    if (dateLines.length === 0) {
      return res.status(400).json({
        error: "截圖缺少時間紀錄，請重新截圖，務必包含『時間』。"
      });
    }

    /* 今日日期（台灣） */
    const todayTW = new Date().toLocaleDateString("zh-TW", {
      timeZone: "Asia/Taipei"
    });

    /* 是否至少有一行是今日 */
    const hasToday = dateLines.some(l => normalizeDateString(l).includes(todayTW));

    if (!hasToday) {
      return res.status(400).json({
        error: "此截圖有非今日擊殺紀錄，請重新截圖，確認所有擊殺紀錄皆為本日。"
      });
    }

    /* ==================================
        🔪 擊殺紀錄分析
    ===================================*/
    const allUsers = await User.find({}, "name");

    const killLines = raw.split("\n").filter(l =>
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

    for (let line of killLines) {
      let row = line.replace(/\s/g, "");

      row = trimModeTag(row);

      const gunHit = GUN_LIST.find(g => row.includes(g));
      if (!gunHit) continue;

      const killIndex = Math.max(
        row.indexOf("擊殺"),
        row.indexOf("杀"),
        row.indexOf("㑆"),
        row.indexOf("㓥"),
        row.indexOf("㯜")
      );

      const useIndex = row.indexOf("使用");
      if (useIndex === -1 || killIndex === -1) continue;

      const attacker = cleanName(row.substring(0, useIndex));
      const victim = cleanName(row.substring(killIndex + 2));

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

    /* ==================================
        💰 金額計算
    ===================================*/
    const PRICE_KILL = 100000;

    const totalMoney = kills * PRICE_KILL;
    const moneyText = totalMoney >= 10000 ? `${totalMoney / 10000}W` : `${totalMoney}`;

    /* ==================================
        🗃 寫入資料庫
    ===================================*/
    const record = await KillRecord.create({
      uploader: uploaderName,
      guild: uploader.guild,
      kills,
      deaths,
      mistakes,
      money: totalMoney,
      imageUrl: imageUrl //圖片
    });

    /* 回傳 */
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
    console.error("❌ Vision OCR 錯誤：", err);
    return res.status(500).json({
      error: "Vision API 分析失敗",
      detail: err.message,
    });
  }
});

export default router;
