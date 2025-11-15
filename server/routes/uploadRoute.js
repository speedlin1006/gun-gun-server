import express from "express";
import multer from "multer";
import cloudinary from "../utils/cloudinary.js";
import fs from "fs";

const router = express.Router();
const upload = multer({ dest: "uploads/" });

router.post("/upload", upload.single("image"), async (req, res) => {
  try {
    const filePath = req.file.path;

    // ⭐ 依照當天日期建立資料夾：killshots/YYYY/MM
    const now = new Date();
    const year = now.getFullYear();                          // 2025
    const month = String(now.getMonth() + 1).padStart(2, "0"); // 11 → 01~12

    const folderPath = `killshots/${year}/${month}`;

    // ⭐ 上傳到 Cloudinary
    const result = await cloudinary.uploader.upload(filePath, {
      folder: folderPath,
      resource_type: "image",
      format: "png",
      transformation: [
        { fetch_format: "png", quality: "100" }
      ],
      flags: "force_strip"
    });

    // ⭐ 刪除本地暫存檔
    fs.unlinkSync(filePath);

    res.json({
      success: true,
      url: result.secure_url,
      folder: folderPath
    });

  } catch (err) {
    console.error("上傳錯誤：", err);
    res.status(500).json({ success: false, error: "Cloudinary 上傳失敗" });
  }
});

export default router;
