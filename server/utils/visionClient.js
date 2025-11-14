import vision from "@google-cloud/vision";

let client;

if (process.env.GOOGLE_VISION_KEY) {
  console.log("🟦 使用 GOOGLE_VISION_KEY 字串建立 Vision 客戶端");

  const keyObj = JSON.parse(process.env.GOOGLE_VISION_KEY);

  client = new vision.ImageAnnotatorClient({
    credentials: keyObj,
    projectId: keyObj.project_id,
  });

} else {
  console.error("❌ GOOGLE_VISION_KEY 未設定");
  process.exit(1);
}

export default client;
