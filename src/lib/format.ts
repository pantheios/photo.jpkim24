// 미디어 상대경로 → 보호된 서빙 URL
export function mediaUrl(relPath: string): string {
  return "/media/" + relPath.split("/").map(encodeURIComponent).join("/");
}

// 사진 상세정보 (osxphotos에서 추출해 Media.meta에 JSON으로 저장)
export type PhotoMeta = {
  camera?: string;
  make?: string;
  lens?: string;
  aperture?: number;
  focalLength?: number;
  iso?: number;
  shutter?: number; // 초 단위
  latitude?: number;
  longitude?: number;
  place?: string;
};

export function parsePhotoMeta(raw: string | null | undefined): PhotoMeta | null {
  if (!raw) return null;
  try {
    const o = JSON.parse(raw);
    return o && typeof o === "object" ? (o as PhotoMeta) : null;
  } catch {
    return null;
  }
}

const KST = { timeZone: "Asia/Seoul" } as const;

export function formatDate(d: Date | string): string {
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleDateString("ko-KR", {
    ...KST,
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export function formatDateTime(d: Date | string): string {
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleString("ko-KR", {
    ...KST,
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function timeAgo(d: Date | string): string {
  const date = typeof d === "string" ? new Date(d) : d;
  const sec = Math.floor((Date.now() - date.getTime()) / 1000);
  if (sec < 60) return "방금 전";
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}분 전`;
  const hour = Math.floor(min / 60);
  if (hour < 24) return `${hour}시간 전`;
  const day = Math.floor(hour / 24);
  if (day < 7) return `${day}일 전`;
  return formatDate(date);
}
