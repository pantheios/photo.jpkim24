import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { AppHeader } from "@/components/AppHeader";
import { PostCard } from "@/components/PostCard";
import { ageLabel } from "@/lib/age";

export const dynamic = "force-dynamic";

export default async function FeedPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const [child, posts] = await Promise.all([
    prisma.child.findFirst({ orderBy: { createdAt: "desc" } }),
    prisma.post.findMany({
      orderBy: { takenAt: "desc" },
      include: {
        author: { select: { name: true } },
        media: { orderBy: { order: "asc" } },
        reactions: { select: { emoji: true, userId: true } },
        _count: { select: { comments: true } },
      },
    }),
  ]);

  return (
    <>
      <AppHeader name={user.name} role={user.role} />

      <main className="mx-auto max-w-xl px-4 pb-28 pt-4">
        {child && (
          <div className="mb-4 flex items-center gap-3 rounded-card bg-surface px-4 py-3 shadow-sm ring-1 ring-line">
            <span className="text-2xl">👶</span>
            <div>
              <div className="font-semibold">{child.name}</div>
              <div className="text-sm text-primary">{ageLabel(child.birthDate)}</div>
            </div>
          </div>
        )}

        {!child && user.role === "admin" && (
          <Link
            href="/admin"
            className="mb-4 block rounded-card border border-dashed border-primary/50 bg-soft px-4 py-3 text-sm text-primary"
          >
            👶 아기 프로필을 등록하면 사진마다 “생후 며칠”이 표시돼요 →
          </Link>
        )}

        {posts.length === 0 ? (
          <div className="mt-20 text-center text-muted">
            <div className="mb-3 text-5xl">📷</div>
            <p>아직 사진이 없어요.</p>
            <p className="text-sm">첫 사진을 올려보세요!</p>
          </div>
        ) : (
          <div className="space-y-5">
            {posts.map((post) => (
              <PostCard
                key={post.id}
                post={post}
                userId={user.id}
                childBirth={child?.birthDate ?? null}
              />
            ))}
          </div>
        )}
      </main>

      <Link
        href="/upload"
        className="fixed bottom-6 right-1/2 z-20 flex translate-x-1/2 items-center gap-2 rounded-full bg-primary px-6 py-3.5 font-semibold text-white shadow-lg transition hover:bg-primary-hover sm:right-6 sm:translate-x-0"
      >
        <span className="text-lg leading-none">＋</span> 사진 올리기
      </Link>
    </>
  );
}
