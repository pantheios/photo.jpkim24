import path from "node:path";
import fs from "node:fs/promises";

// 업로드 루트 — 셀프호스팅 시 Docker 볼륨으로 마운트.
// (모듈 로드 시점이 아니라 호출 시점에 평가해 빌드 트레이싱 이슈를 피한다)
export function uploadDir(): string {
  return path.resolve(process.env.UPLOAD_DIR || "./data/uploads");
}

// 하위 디렉터리를 보장하고 절대경로를 반환.
export async function ensureUploadDir(sub = ""): Promise<string> {
  const dir = path.join(uploadDir(), sub);
  await fs.mkdir(dir, { recursive: true });
  return dir;
}

// 상대경로를 업로드 루트 안으로 안전하게 결합 (디렉터리 탈출 방지). 벗어나면 null.
export function resolveUpload(relPath: string): string | null {
  const root = uploadDir();
  const full = path.resolve(root, "." + path.sep + relPath);
  if (full !== root && !full.startsWith(root + path.sep)) return null;
  return full;
}

// 연/월 단위로 파일을 분산 저장하기 위한 상대 디렉터리.
export function dateShard(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${y}/${m}`;
}
