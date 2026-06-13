import Link from "next/link";
import { MediaGallery, type GalleryMedia } from "./MediaGallery";
import { ReactionBar } from "./ReactionBar";
import { reactionSummary } from "@/lib/posts";
import { formatDate } from "@/lib/format";
import { ageLabel } from "@/lib/age";

type Props = {
  post: {
    id: string;
    caption: string | null;
    takenAt: Date;
    media: GalleryMedia[];
    reactions: { emoji: string; userId: string }[];
    _count: { comments: number };
  };
  userId: string;
  isAdmin: boolean;
  kids: { id: string; name: string; birthDate: Date }[];
};

export function PostCard({ post, userId, isAdmin, kids }: Props) {
  const { counts, mine } = reactionSummary(post.reactions, userId);

  return (
    <article className="overflow-hidden rounded-card bg-surface shadow-sm ring-1 ring-line">
      <div className="px-4 py-3">
        <div className="text-sm font-semibold">{formatDate(post.takenAt)}</div>
        {kids.length > 0 && (
          <div className="mt-1 flex flex-wrap gap-1 text-xs text-muted">
            {kids.map((k) => (
              <span
                key={k.name}
                className="rounded-full bg-soft px-1.5 py-0.5 text-primary"
              >
                {kids.length > 1 ? `${k.name} ` : ""}
                {ageLabel(k.birthDate, post.takenAt)}
              </span>
            ))}
          </div>
        )}
      </div>

      <MediaGallery
        media={post.media}
        editable={isAdmin}
        allKids={kids.map((k) => ({ id: k.id, name: k.name }))}
      />

      <div className="space-y-2.5 px-4 py-3">
        {post.caption && (
          <p className="whitespace-pre-wrap break-words text-sm">{post.caption}</p>
        )}
        <ReactionBar postId={post.id} initialCounts={counts} initialMine={mine} />
        <Link
          href={`/post/${post.id}`}
          className="block text-sm text-muted hover:text-ink"
        >
          {post._count.comments > 0
            ? `댓글 ${post._count.comments}개 보기`
            : "댓글 달기"}
        </Link>
      </div>
    </article>
  );
}
