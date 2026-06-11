"use client";

import { useState } from "react";
import { timeAgo } from "@/lib/format";

export type CommentItem = {
  id: string;
  body: string;
  createdAt: string;
  author: { id: string; name: string };
};

export function CommentSection({
  postId,
  initial,
  currentUserId,
  isAdmin,
}: {
  postId: string;
  initial: CommentItem[];
  currentUserId: string;
  isAdmin: boolean;
}) {
  const [comments, setComments] = useState<CommentItem[]>(initial);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    const body = text.trim();
    if (!body || loading) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/posts/${postId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body }),
      });
      const data = await res.json();
      if (res.ok) {
        setComments((prev) => [...prev, data.comment]);
        setText("");
      }
    } finally {
      setLoading(false);
    }
  }

  async function remove(id: string) {
    const res = await fetch(`/api/comments/${id}`, { method: "DELETE" });
    if (res.ok) setComments((prev) => prev.filter((c) => c.id !== id));
  }

  return (
    <div>
      <h3 className="mb-3 text-sm font-semibold text-muted">
        댓글 {comments.length}
      </h3>

      <ul className="space-y-3">
        {comments.map((c) => (
          <li key={c.id} className="flex gap-2.5">
            <div className="flex h-8 w-8 flex-none items-center justify-center rounded-full bg-soft text-sm font-semibold text-primary">
              {c.author.name.charAt(0)}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline gap-2">
                <span className="text-sm font-semibold">{c.author.name}</span>
                <span className="text-xs text-muted">{timeAgo(c.createdAt)}</span>
                {(c.author.id === currentUserId || isAdmin) && (
                  <button
                    onClick={() => remove(c.id)}
                    className="ml-auto text-xs text-muted hover:text-red-500"
                  >
                    삭제
                  </button>
                )}
              </div>
              <p className="whitespace-pre-wrap break-words text-sm">{c.body}</p>
            </div>
          </li>
        ))}
        {comments.length === 0 && (
          <li className="py-4 text-center text-sm text-muted">
            첫 댓글을 남겨보세요 💬
          </li>
        )}
      </ul>

      <form onSubmit={add} className="mt-4 flex gap-2">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="댓글 달기…"
          maxLength={1000}
          className="flex-1 rounded-full border border-line bg-white px-4 py-2 text-sm outline-none focus:border-primary"
        />
        <button
          type="submit"
          disabled={!text.trim() || loading}
          className="rounded-full bg-primary px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          등록
        </button>
      </form>
    </div>
  );
}
