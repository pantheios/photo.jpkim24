"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

type Item = { file: File; url: string; isVideo: boolean };

export default function UploadPage() {
  const router = useRouter();
  const [items, setItems] = useState<Item[]>([]);
  const [caption, setCaption] = useState("");
  const [error, setError] = useState("");
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);

  function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = Array.from(e.target.files ?? []);
    if (!picked.length) return;
    const next = picked.map((file) => ({
      file,
      url: URL.createObjectURL(file),
      isVideo: file.type.startsWith("video/"),
    }));
    setItems((prev) => [...prev, ...next]);
    e.target.value = "";
  }

  function remove(idx: number) {
    setItems((prev) => {
      URL.revokeObjectURL(prev[idx].url);
      return prev.filter((_, i) => i !== idx);
    });
  }

  function upload() {
    if (!items.length || uploading) return;
    setUploading(true);
    setError("");
    setProgress(0);

    const fd = new FormData();
    fd.append("caption", caption);
    for (const it of items) fd.append("files", it.file);

    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/upload");
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) setProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        const data = JSON.parse(xhr.responseText);
        router.replace(`/post/${data.postId}`);
        router.refresh();
      } else {
        setUploading(false);
        try {
          setError(JSON.parse(xhr.responseText).error || "업로드에 실패했습니다.");
        } catch {
          setError("업로드에 실패했습니다.");
        }
      }
    };
    xhr.onerror = () => {
      setUploading(false);
      setError("네트워크 오류가 발생했습니다.");
    };
    xhr.send(fd);
  }

  return (
    <>
      <header className="sticky top-0 z-20 border-b border-line bg-cream/90 backdrop-blur">
        <div className="mx-auto flex max-w-xl items-center justify-between px-4 py-3">
          <Link href="/" className="text-sm text-muted hover:text-ink">
            ← 취소
          </Link>
          <span className="font-semibold">사진 올리기</span>
          <button
            onClick={upload}
            disabled={!items.length || uploading}
            className="text-sm font-semibold text-primary disabled:opacity-40"
          >
            {uploading ? "올리는 중…" : "올리기"}
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-xl px-4 py-5">
        {items.length > 0 && (
          <div className="mb-4 grid grid-cols-3 gap-2">
            {items.map((it, i) => (
              <div
                key={it.url}
                className="relative aspect-square overflow-hidden rounded-lg bg-soft"
              >
                {it.isVideo ? (
                  <video src={it.url} className="h-full w-full object-cover" />
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={it.url} alt="" className="h-full w-full object-cover" />
                )}
                <button
                  onClick={() => remove(i)}
                  className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-black/55 text-xs text-white"
                  aria-label="제거"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}

        <label className="flex cursor-pointer flex-col items-center justify-center rounded-card border-2 border-dashed border-line bg-surface py-10 text-muted transition hover:border-primary hover:text-primary">
          <span className="mb-1 text-3xl">＋</span>
          <span className="text-sm">사진 / 동영상 선택</span>
          <input
            type="file"
            accept="image/*,video/*"
            multiple
            onChange={onPick}
            className="hidden"
          />
        </label>

        <textarea
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
          placeholder="오늘의 한 줄… (선택)"
          rows={3}
          className="mt-4 w-full resize-none rounded-card border border-line bg-surface px-4 py-3 outline-none focus:border-primary"
        />

        {error && <p className="mt-3 text-sm text-red-500">{error}</p>}

        {uploading && (
          <div className="mt-4">
            <div className="h-2 overflow-hidden rounded-full bg-line">
              <div
                className="h-full rounded-full bg-primary transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="mt-1 text-center text-xs text-muted">{progress}%</p>
          </div>
        )}
      </main>
    </>
  );
}
