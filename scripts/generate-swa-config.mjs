import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

// .env ファイルを読み込む（存在する場合）
function loadEnv() {
  const envPath = resolve(root, ".env");
  if (!existsSync(envPath)) return;

  const content = readFileSync(envPath, "utf-8");
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const eqIndex = trimmed.indexOf("=");
    if (eqIndex === -1) continue;

    const key = trimmed.slice(0, eqIndex).trim();
    const value = trimmed.slice(eqIndex + 1).trim().replace(/^["']|["']$/g, "");

    // 既に環境変数がセットされていたらそちらを優先
    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

loadEnv();

// テンプレートを読み込み
const templatePath = resolve(root, "staticwebapp.config.template.json");
let config = readFileSync(templatePath, "utf-8");

// $VARIABLE_NAME 形式のプレースホルダーを環境変数で置換
config = config.replace(/\$([A-Z_][A-Z0-9_]*)/g, (match, varName) => {
  const value = process.env[varName];
  if (!value) {
    console.warn(`⚠️  環境変数 ${varName} が設定されていません`);
    return match;
  }
  return value;
});

// JSON として正しいか検証
try {
  JSON.parse(config);
} catch (e) {
  console.error("❌ 生成された staticwebapp.config.json が不正なJSONです:", e.message);
  process.exit(1);
}

// dist/ に出力
const distDir = resolve(root, "dist");
if (!existsSync(distDir)) {
  mkdirSync(distDir, { recursive: true });
}

const outputPath = resolve(distDir, "staticwebapp.config.json");
writeFileSync(outputPath, config, "utf-8");
console.log("✅ dist/staticwebapp.config.json を生成しました");
