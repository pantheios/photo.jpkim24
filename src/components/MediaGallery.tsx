"use client";

import { useRef, useState } from "react";
import { mediaUrl } from "@/lib/format";
import { MEDIA } from "@/lib/constants";

export type GalleryMedia = {
  id: string;
  type: string;
  path: string;
  thumbPath: string | null;
  width: number | null;
  height: number | null;
};

export function MediaGallery({
  media,
  size = "feed",
}: {
  media: GalleryMedia[];
  size?: "feed" | "full";
}) {
  const [active, setActive] = useState(0);
  const ref = useRef<HTMLDivElement>(null);

  if (media.length === 0) return null;

  function onScroll() {
    const el = ref.current;
    if (!el) return;
    const idx = Math.round(el.scrollLeft / el.clientWidth);
    setActive(idx);
  }

  const itemClass =
    size === "feed"
      ? "aspect-square"
      : "flex max-h-[80vh] items-center justify-center";

  return (
    <div className="relative">
      <div
        ref={ref}
        onScroll={onScroll}
        className="flex snap-x snap-mandatory overflow-x-auto scroll-smooth"
        style={{ scrollbarWidth: "none" }}
      >
        {media.map((m) => (
          <div
            key={m.id}
            className={`w-full flex-none snap-center bg-soft ${itemClass}`}
          >
            {m.type === MEDIA.VIDEO ? (
              <video
                src={mediaUrl(m.path)}
                controls
                playsInline
                className={
                  size === "feed"
                    ? "h-full w-full object-cover"
                    : "max-h-[80vh] w-full object-contain"
                }
              />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={mediaUrl(size === "feed" ? m.thumbPath || m.path : m.path)}
                alt=""
                loading="lazy"
                className={
                  size === "feed"
                    ? "h-full w-full object-cover"
                    : "max-h-[80vh] w-full object-contain"
                }
              />
            )}
          </div>
        ))}
      </div>

      {media.length > 1 && (
        <>
          <div className="absolute right-2 top-2 rounded-full bg-black/55 px-2 py-0.5 text-xs font-medium text-white">
            {active + 1} / {media.length}
          </div>
          <div className="pointer-events-none absolute bottom-2 left-0 right-0 flex justify-center gap-1.5">
            {media.map((m, i) => (
              <span
                key={m.id}
                className={`h-1.5 w-1.5 rounded-full transition ${
                  i === active ? "bg-white" : "bg-white/50"
                }`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
