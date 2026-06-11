// PWA 아이콘 생성: 따뜻한 색 배경 + 흰색 카메라 글리프
import sharp from "sharp";
import { mkdir } from "node:fs/promises";

const BG = "#e0846b";

const ICON = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="112" fill="${BG}"/>
  <rect x="120" y="180" width="272" height="184" rx="32" fill="#ffffff"/>
  <rect x="214" y="150" width="84" height="44" rx="14" fill="#ffffff"/>
  <circle cx="256" cy="272" r="60" fill="${BG}"/>
  <circle cx="256" cy="272" r="38" fill="#ffffff"/>
  <circle cx="344" cy="214" r="12" fill="${BG}"/>
</svg>`;

await mkdir("public", { recursive: true });

const targets = [
  { size: 192, name: "icon-192.png" },
  { size: 512, name: "icon-512.png" },
  { size: 180, name: "apple-touch-icon.png" },
];

for (const { size, name } of targets) {
  await sharp(Buffer.from(ICON)).resize(size, size).png().toFile(`public/${name}`);
  console.log("wrote public/" + name);
}
