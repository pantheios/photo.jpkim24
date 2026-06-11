import Link from "next/link";
import { MediaGallery, type GalleryMedia } from "./MediaGallery";
import { ReactionBar } from "./ReactionBar";
import { Avatar } from "./Avatar";
import { reactionSummary } from "@/lib/posts";
import { formatDate } from "@/lib/format";
import { ageLabel } from "@/lib/age";

type Props = {
  post: {
    id: string;
    caption: string | null;
    takenAt: Date;
    source: string;
    author: { name: string };
    media: GalleryMedia[];
    reactions: { emoji: string; userId: string }[];
    _count: { comments: number };
  };
  userId: string;
  childBirth: Date | null;
};

export function PostCard({ post, userId, childBirth }: Props) {
  const { counts, mine } = reactionSummary(post.reactions, userId);

  return (
    <article className="overflow-hidden rounded-card bg-surface shadow-sm ring-1 ring-line">
      <div className="flex items-center gap-2.5 px-4 py-3">
        <Avatar name={post.author.name} />
        <div className="min-w-0">
          <div className="text-sm font-semibold">
            {post.source === "icloud" ? "☁️ 공유앨범" : post.author.name}
          </div>
          <div className="text-xs text-muted">
            {formatDate(post.takenAt)}
            {childBirth && (
              <span className="ml-1.5 rounded-full bg-soft px-1.5 py-0.5 text-primary">
                {ageLabel(childBirth, post.takenAt)}
              </span>
            )}
          </div>
        </div>
      </div>

      <Link href={`/post/${post.id}`} className="block">
        <MediaGallery media={post.media} size="feed" />
      </Link>

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
