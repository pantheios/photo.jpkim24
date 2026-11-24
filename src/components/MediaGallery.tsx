"use client";

import { useEffect, useState } from "react";
import { mediaUrl, formatDateTime, type PhotoMeta } from "@/lib/format";
import { MEDIA } from "@/lib/constants";

export type GalleryMedia = {
  id: string;
  type: string;
  path: string;
  thumbPath: string | null;
  width: number | null;
  height: number | null;
  takenAt?: Date | string | null;
  createdAt?: Date | string | null;
  meta?: PhotoMeta | null;
  childIds?: string[]; // 이 사진에 태깅된 아이 id (편집용)
};

// 촬영설정 한 줄: f/2.8 · 50mm · ISO 1600 · 1/200s
function cameraSettings(meta: PhotoMeta): string {
  const parts: string[] = [];
  if (meta.aperture) parts.push(`f/${meta.aperture}`);
  if (meta.focalLength) parts.push(`${Math.round(meta.focalLength)}mm`);
  if (meta.iso) parts.push(`ISO ${meta.iso}`);
  if (meta.shutter) {
    parts.push(meta.shutter >= 1 ? `${meta.shutter}s` : `1/${Math.round(1 / meta.shutter)}s`);
  }
  return parts.join(" · ");
}

export type KidOption = { id: string; name: string };

const PAGE_SIZE = 9; // 3 x 3

export function MediaGallery({
  media,
  editable = false,
  allKids,
}: {
  media: GalleryMedia[];
  /** 관리자면 라이트박스에서 아이 태그를 직접 수정 가능 */
  editable?: boolean;
  allKids?: KidOption[];
}) {
  const [page, setPage] = useState(0);
  const [lightbox, setLightbox] = useState<number | null>(null);
  // 사진별 아이 태그 (낙관적 업데이트용 로컬 상태)
  const [tags, setTags] = useState<Record<string, string[]>>(() =>
    Object.fromEntries(media.map((m) => [m.id, m.childIds ?? []])),
  );

  if (media.length === 0) return null;

  const totalPages = Math.ceil(media.length / PAGE_SIZE);
  const start = page * PAGE_SIZE;
  const pageItems = media.slice(start, start + PAGE_SIZE);

  async function toggleTag(mediaId: string, childId: string) {
    const current = tags[mediaId] ?? [];
    const next = current.includes(childId)
      ? current.filter((x) => x !== childId)
      : [...current, childId];
    setTags((t) => ({ ...t, [mediaId]: next })); // 낙관적 반영
    try {
      const res = await fetch(`/api/media/${mediaId}/children`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ childIds: next }),
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setTags((t) => ({ ...t, [mediaId]: data.childIds ?? next }));
    } catch {
      setTags((t) => ({ ...t, [mediaId]: current })); // 실패 시 롤백
    }
  }

  return (
    <div>
      <div className="grid grid-cols-3 gap-0.5">
        {pageItems.map((m, i) => {
          const globalIndex = start + i;
          return (
            <button
              key={m.id}
              type="button"
              onClick={() => setLightbox(globalIndex)}
              className="block"
            >
              <div className="relative aspect-square overflow-hidden bg-soft">
                {m.type === MEDIA.VIDEO ? (
                  <>
                    <video
                      src={mediaUrl(m.path)}
                      muted
                      playsInline
                      preload="metadata"
                      className="h-full w-full object-cover"
                    />
                    <span className="pointer-events-none absolute inset-0 flex items-center justify-center">
                      <span className="flex h-9 w-9 items-center justify-center rounded-full bg-black/55 text-white">
                        ▶
                      </span>
                    </span>
                  </>
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={mediaUrl(m.thumbPath || m.path)}
                    alt=""
                    loading="lazy"
                    className="h-full w-full object-cover"
                  />
                )}
              </div>
            </button>
          );
        })}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-4 py-2 text-sm">
          <button
            type="button"
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={page === 0}
            className="rounded-full px-3 py-1 text-muted enabled:hover:text-primary disabled:opacity-30"
            aria-label="이전 사진"
          >
            ‹
          </button>
          <span className="tabular-nums text-muted">
            {page + 1} / {totalPages}
          </span>
          <button
            type="button"
            onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
            disabled={page === totalPages - 1}
            className="rounded-full px-3 py-1 text-muted enabled:hover:text-primary disabled:opacity-30"
            aria-label="다음 사진"
          >
            ›
          </button>
        </div>
      )}

      {lightbox !== null && (
        <Lightbox
          media={media}
          index={lightbox}
          onIndex={setLightbox}
          onClose={() => setLightbox(null)}
          editable={editable}
          allKids={allKids}
          tags={tags}
          onToggleTag={toggleTag}
        />
      )}
    </div>
  );
}

function Lightbox({
  media,
  index,
  onIndex,
  onClose,
  editable,
  allKids,
  tags,
  onToggleTag,
}: {
  media: GalleryMedia[];
  index: number;
  onIndex: (i: number) => void;
  onClose: () => void;
  editable: boolean;
  allKids?: KidOption[];
  tags: Record<string, string[]>;
  onToggleTag: (mediaId: string, childId: string) => void;
}) {
  const m = media[index];
  const hasPrev = index > 0;
  const hasNext = index < media.length - 1;
  const isVideo = m.type === MEDIA.VIDEO;
  const current = tags[m.id] ?? [];
  const taggedNames = current
    .map((id) => allKids?.find((k) => k.id === id)?.name)
    .filter((n): n is string => Boolean(n));

  const [info, setInfo] = useState(false);
  const [loop, setLoop] = useState(false);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        if (info) setInfo(false);
        else onClose();
      } else if (e.key === "ArrowLeft" && index > 0) onIndex(index - 1);
      else if (e.key === "ArrowRight" && index < media.length - 1) onIndex(index + 1);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [index, media.length, onIndex, onClose, info]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/95"
      onClick={onClose}
    >
      <div className="absolute left-4 top-4 z-10 flex gap-2" onClick={(e) => e.stopPropagation()}>
        <button
          type="button"
          onClick={() => setInfo((v) => !v)}
          className={`flex h-10 items-center gap-1.5 rounded-full px-3.5 text-sm font-medium transition ${
            info ? "bg-white text-ink" : "bg-white/15 text-white hover:bg-white/25"
          }`}
          aria-label="상세정보"
        >
          ⓘ 상세정보
        </button>
        {isVideo && (
          <button
            type="button"
            onClick={() => setLoop((v) => !v)}
            className={`flex h-10 items-center gap-1.5 rounded-full px-3.5 text-sm font-medium transition ${
              loop ? "bg-white text-ink" : "bg-white/15 text-white hover:bg-white/25"
            }`}
            aria-label="반복 재생"
            aria-pressed={loop}
          >
            🔁 반복
          </button>
        )}
      </div>

      <button
        type="button"
        onClick={onClose}
        className="absolute right-4 top-4 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-white/15 text-xl text-white hover:bg-white/25"
        aria-label="닫기"
      >
        ✕
      </button>

      <div className="absolute top-5 left-1/2 -translate-x-1/2 text-sm text-white/80">
        {index + 1} / {media.length}
      </div>

      {hasPrev && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onIndex(index - 1);
          }}
          className="absolute left-2 z-10 flex h-12 w-12 items-center justify-center rounded-full bg-white/15 text-2xl text-white hover:bg-white/25"
          aria-label="이전"
        >
          ‹
        </button>
      )}

      <div className="max-h-[90vh] max-w-[95vw]" onClick={(e) => e.stopPropagation()}>
        {m.type === MEDIA.VIDEO ? (
          <video
            src={mediaUrl(m.path)}
            controls
            autoPlay
            playsInline
            loop={loop}
            className="max-h-[90vh] max-w-[95vw]"
          />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={mediaUrl(m.path)}
            alt=""
            className="max-h-[90vh] max-w-[95vw] object-contain"
          />
        )}
      </div>

      {hasNext && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onIndex(index + 1);
          }}
          className="absolute right-2 z-10 flex h-12 w-12 items-center justify-center rounded-full bg-white/15 text-2xl text-white hover:bg-white/25"
          aria-label="다음"
        >
          ›
        </button>
      )}

      {info && (
        <div
          className="absolute inset-x-0 bottom-0 z-10 bg-gradient-to-t from-black/95 to-black/70 px-5 pb-6 pt-5 text-white"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="mx-auto max-w-md space-y-3 text-sm">
            <dl className="space-y-2">
              <div className="flex gap-3">
                <dt className="w-20 shrink-0 text-white/55">촬영일시</dt>
                <dd>{m.takenAt ? formatDateTime(m.takenAt) : "정보 없음"}</dd>
              </div>
              <div className="flex gap-3">
                <dt className="w-20 shrink-0 text-white/55">종류</dt>
                <dd>{isVideo ? "동영상" : "사진"}</dd>
              </div>
              {!isVideo && m.width && m.height && (
                <div className="flex gap-3">
                  <dt className="w-20 shrink-0 text-white/55">해상도</dt>
                  <dd>
                    {m.width} × {m.height}
                  </dd>
                </div>
              )}
              {m.meta?.camera && (
                <div className="flex gap-3">
                  <dt className="w-20 shrink-0 text-white/55">카메라</dt>
                  <dd>{m.meta.camera}</dd>
                </div>
              )}
              {m.meta?.lens && (
                <div className="flex gap-3">
                  <dt className="w-20 shrink-0 text-white/55">렌즈</dt>
                  <dd>{m.meta.lens}</dd>
                </div>
              )}
              {m.meta && cameraSettings(m.meta) && (
                <div className="flex gap-3">
                  <dt className="w-20 shrink-0 text-white/55">촬영설정</dt>
                  <dd>{cameraSettings(m.meta)}</dd>
                </div>
              )}
              {m.meta?.place && (
                <div className="flex gap-3">
                  <dt className="w-20 shrink-0 text-white/55">위치</dt>
                  <dd>
                    {m.meta.latitude && m.meta.longitude ? (
                      <a
                        href={`https://maps.apple.com/?ll=${m.meta.latitude},${m.meta.longitude}&q=${encodeURIComponent(m.meta.place)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="underline decoration-white/30 underline-offset-2 hover:decoration-white"
                      >
                        {m.meta.place}
                      </a>
                    ) : (
                      m.meta.place
                    )}
                  </dd>
                </div>
              )}
              {m.createdAt && (
                <div className="flex gap-3">
                  <dt className="w-20 shrink-0 text-white/55">추가된 날</dt>
                  <dd>{formatDateTime(m.createdAt)}</dd>
                </div>
              )}
            </dl>

            <div className="flex gap-3">
              <span className="w-20 shrink-0 pt-1.5 text-white/55">사진 속 아이</span>
              {editable && allKids && allKids.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {allKids.map((k) => {
                    const on = current.includes(k.id);
                    return (
                      <button
                        key={k.id}
                        type="button"
                        onClick={() => onToggleTag(m.id, k.id)}
                        className={`rounded-full px-3 py-1 text-sm ring-1 transition ${
                          on
                            ? "bg-primary text-white ring-primary"
                            : "bg-white/10 text-white/80 ring-white/30 hover:bg-white/20"
                        }`}
                      >
                        {on ? "✓ " : ""}
                        {k.name}
                      </button>
                    );
                  })}
                </div>
              ) : (
                <span className="pt-0.5">
                  {taggedNames.length > 0 ? taggedNames.join(", ") : "태그 없음"}
                </span>
              )}
            </div>
            {editable && (
              <p className="text-xs text-white/40">
                얼굴 인식이 틀렸으면 이름을 눌러 바로잡을 수 있어요.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
