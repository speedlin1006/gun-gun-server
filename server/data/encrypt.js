import fs from "fs"

function encode(text, shift = 5) {
  return [...text].map(c => String.fromCharCode(c.charCodeAt(0) + shift)).join("")
}

const raw = JSON.parse(fs.readFileSync("users.json", "utf8"))

const updated = raw.map(entry => ({
  ...entry,
  password: encode(entry.password)
}))

fs.writeFileSync("output.json", JSON.stringify(updated, null, 2), "utf8")
console.log("✅ Password 欄位已加密")
