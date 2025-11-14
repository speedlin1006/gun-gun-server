import express from "express";
import multer from "multer";
import cloudinary from "../utils/cloudinary.js";
import fs from "fs";

const router = express.Router();
const upload = multer({ dest: "uploads/" });

router.post("/upload", upload.single("image"), async (req, res) => {
  try {
    const filePath = req.file.path;

    // ⭐ 強制 PNG、禁止壓縮、禁止自動格式
    const result = await cloudinary.uploader.upload(filePath, {
      folder: "killshots",
      resource_type: "image",
      format: "png",                              // 強制輸出 PNG
      transformation: [
        { fetch_format: "png", quality: "100" }  // 不壓縮 + 不自動格式
      ],
      flags: "force_strip"                        // 移除多餘的 metadata
    });

    // 刪除本地檔案
    fs.unlinkSync(filePath);

    res.json({
      success: true,
      url: result.secure_url
    });

  } catch (err) {
    console.error("上傳錯誤：", err);
    res.status(500).json({ success: false, error: "Cloudinary 上傳失敗" });
  }
});

export default router;
