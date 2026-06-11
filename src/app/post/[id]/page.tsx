import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { reactionSummary } from "@/lib/posts";
import { ageLabel } from "@/lib/age";
import { formatDateTime } from "@/lib/format";
import { ROLES } from "@/lib/constants";
import { MediaGallery } from "@/components/MediaGallery";
import { ReactionBar } from "@/components/ReactionBar";
import { CommentSection } from "@/components/CommentSection";
import { DeletePostButton } from "@/components/DeletePostButton";
import { Avatar } from "@/components/Avatar";

export const dynamic = "force-dynamic";

export default async function PostDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const { id } = await params;
  const post = await prisma.post.findUnique({
    where: { id },
    include: {
      author: { select: { id: true, name: true } },
      media: { orderBy: { order: "asc" } },
      reactions: { select: { emoji: true, userId: true } },
      comments: {
        orderBy: { createdAt: "asc" },
        include: { author: { select: { id: true, name: true } } },
      },
    },
  });
  if (!post) notFound();

  const child = await prisma.child.findFirst({ orderBy: { createdAt: "desc" } });
  const { counts, mine } = reactionSummary(post.reactions, user.id);
  const canDelete = post.authorId === user.id || user.role === ROLES.ADMIN;
  const comments = post.comments.map((c) => ({
    id: c.id,
    body: c.body,
    createdAt: c.createdAt.toISOString(),
    author: { id: c.author.id, name: c.author.name },
  }));

  return (
    <>
      <header className="sticky top-0 z-20 border-b border-line bg-cream/90 backdrop-blur">
        <div className="mx-auto flex max-w-xl items-center justify-between px-4 py-3">
          <Link href="/" className="text-sm text-muted hover:text-ink">
            ← 홈
          </Link>
          {canDelete && <DeletePostButton postId={post.id} />}
        </div>
      </header>

      <main className="mx-auto max-w-xl pb-16">
        <div className="flex items-center gap-2.5 px-4 py-3">
          <Avatar name={post.author.name} />
          <div>
            <div className="text-sm font-semibold">{post.author.name}</div>
            <div className="text-xs text-muted">
              {formatDateTime(post.takenAt)}
              {child && (
                <span className="ml-1.5 rounded-full bg-soft px-1.5 py-0.5 text-primary">
                  {ageLabel(child.birthDate, post.takenAt)}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="overflow-hidden bg-surface sm:rounded-card sm:ring-1 sm:ring-line">
          <MediaGallery media={post.media} size="full" />
        </div>

        <div className="space-y-4 px-4 py-4">
          {post.caption && (
            <p className="whitespace-pre-wrap break-words">{post.caption}</p>
          )}
          <ReactionBar postId={post.id} initialCounts={counts} initialMine={mine} />
          <hr className="border-line" />
          <CommentSection
            postId={post.id}
            initial={comments}
            currentUserId={user.id}
            isAdmin={user.role === ROLES.ADMIN}
          />
        </div>
      </main>
    </>
  );
}
