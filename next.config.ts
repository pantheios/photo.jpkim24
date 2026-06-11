import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 네이티브/Node 전용 패키지는 번들하지 않고 런타임에서 require 하도록 외부화
  serverExternalPackages: [
    "sharp",
    "exifr",
    "better-sqlite3",
    "@prisma/adapter-better-sqlite3",
  ],
};

export default nextConfig;
