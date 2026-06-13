export const ROLES = { ADMIN: "admin", MEMBER: "member" } as const;
export type Role = (typeof ROLES)[keyof typeof ROLES];

export const MEDIA = { IMAGE: "image", VIDEO: "video" } as const;
export type MediaType = (typeof MEDIA)[keyof typeof MEDIA];

// 사진에 남길 수 있는 이모지 반응
export const REACTION_EMOJIS = ["❤️", "😍", "👏", "🥹", "😂", "🎉"] as const;

// 업로드 허용 타입 / 용량
export const ACCEPTED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"];
export const ACCEPTED_VIDEO_TYPES = ["video/mp4", "video/quicktime", "video/webm"];
export const MAX_FILE_BYTES = 50 * 1024 * 1024; // 50MB (웹 업로드)
export const INGEST_MAX_FILE_BYTES = 300 * 1024 * 1024; // 300MB (동기화 에이전트 — 원본 동영상 대응)
