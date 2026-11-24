import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { AppHeader } from "@/components/AppHeader";
import { PostCard } from "@/components/PostCard";
import { ageLabel } from "@/lib/age";
import { parsePhotoMeta } from "@/lib/format";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 15;

// 필터·페이지를 유지하는 피드 URL 생성
function feedHref(opts: { child?: string; type?: string; page?: number }): string {
  const sp = new URLSearchParams();
  if (opts.child) sp.set("child", opts.child);
  if (opts.type) sp.set("type", opts.type);
  if (opts.page && opts.page > 1) sp.set("page", String(opts.page));
  const qs = sp.toString();
  return qs ? `/?${qs}` : "/";
}

export default async function FeedPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; child?: string; type?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const activeChild = sp.child || undefined;
  const activeType = sp.type === "video" || sp.type === "image" ? sp.type : undefined;

  // 미디어 단위 필터 (아이 + 사진/동영상). 게시물은 조건에 맞는 미디어가 있는 것만,
  // 게시물 안에서도 조건에 맞는 미디어만 보여준다.
  const childCond = activeChild ? { children: { some: { childId: activeChild } } } : undefined;
  const mediaWhere =
    childCond && activeType
      ? { ...childCond, type: activeType }
      : childCond
        ? childCond
        : activeType
          ? { type: activeType }
          : undefined;
  const where = mediaWhere ? { media: { some: mediaWhere } } : {};

  const [kids, total, posts] = await Promise.all([
    prisma.child.findMany({ orderBy: { birthDate: "asc" } }),
    prisma.post.count({ where }),
    prisma.post.findMany({
      where,
      orderBy: { takenAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: {
        author: { select: { name: true } },
        media: {
          where: mediaWhere,
          orderBy: [{ takenAt: { sort: "asc", nulls: "last" } }, { order: "asc" }],
          include: { children: { select: { childId: true } } },
        },
        reactions: { select: { emoji: true, userId: true } },
        _count: { select: { comments: true } },
      },
    }),
  ]);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <>
      <AppHeader name={user.name} role={user.role} />

      <main className="mx-auto max-w-xl px-4 pb-28 pt-4">
        {/* 사진/동영상 필터 */}
        <div className="mb-3 flex gap-2">
          {[
            { key: undefined as string | undefined, label: "전체" },
            { key: "image", label: "📷 사진" },
            { key: "video", label: "🎬 동영상" },
          ].map((t) => {
            const on = activeType === t.key;
            return (
              <Link
                key={t.label}
                href={feedHref({ child: activeChild, type: t.key })}
                className={`rounded-full px-3 py-1 text-sm ring-1 transition ${
                  on
                    ? "bg-primary text-white ring-primary"
                    : "bg-soft text-ink ring-line hover:ring-primary"
                }`}
              >
                {t.label}
              </Link>
            );
          })}
        </div>

        {kids.length > 0 && (
          <div className="mb-4 flex items-center gap-3 rounded-card bg-surface px-4 py-3 shadow-sm ring-1 ring-line">
            <span className="text-2xl">👶</span>
            <div className="flex flex-wrap gap-2">
              {kids.length > 1 && (
                <Link
                  href={feedHref({ type: activeType })}
                  className={`rounded-full px-3 py-1 text-sm ring-1 transition ${
                    !activeChild
                      ? "bg-primary text-white ring-primary"
                      : "bg-soft text-ink ring-line hover:ring-primary"
                  }`}
                >
                  전체
                </Link>
              )}
              {kids.map((c) => {
                const on = activeChild === c.id;
                return (
                  <Link
                    key={c.id}
                    href={on ? feedHref({ type: activeType }) : feedHref({ child: c.id, type: activeType })}
                    className={`rounded-full px-3 py-1 text-sm ring-1 transition ${
                      on
                        ? "bg-primary text-white ring-primary"
                        : "bg-soft text-ink ring-line hover:ring-primary"
                    }`}
                  >
                    <span className="font-semibold">{c.name}</span>{" "}
                    <span className={on ? "text-white/85" : "text-primary"}>
                      {ageLabel(c.birthDate)}
                    </span>
                  </Link>
                );
              })}
            </div>
          </div>
        )}

        {kids.length === 0 && user.role === "admin" && (
          <Link
            href="/admin"
            className="mb-4 block rounded-card border border-dashed border-primary/50 bg-soft px-4 py-3 text-sm text-primary"
          >
            👶 아이 프로필을 등록하면 사진마다 “생후 며칠”이 표시돼요 →
          </Link>
        )}

        {posts.length === 0 ? (
          <div className="mt-20 text-center text-muted">
            <div className="mb-3 text-5xl">{activeType === "video" ? "🎬" : "📷"}</div>
            {activeChild || activeType ? (
              <>
                <p>조건에 맞는 항목이 없어요.</p>
                <Link href={feedHref({})} className="text-sm text-primary">
                  전체 보기 →
                </Link>
              </>
            ) : (
              <>
                <p>아직 사진이 없어요.</p>
                <p className="text-sm">첫 사진을 올려보세요!</p>
              </>
            )}
          </div>
        ) : (
          <div className="space-y-5">
            {posts.map((post) => (
              <PostCard
                key={post.id}
                post={{
                  ...post,
                  media: post.media.map((m) => ({
                    ...m,
                    meta: parsePhotoMeta(m.meta),
                    childIds: m.children.map((c) => c.childId),
                  })),
                }}
                userId={user.id}
                isAdmin={user.role === "admin"}
                kids={kids.map((c) => ({ id: c.id, name: c.name, birthDate: c.birthDate }))}
              />
            ))}
          </div>
        )}

        {totalPages > 1 && (
          <nav className="mt-6 flex items-center justify-between text-sm">
            {page > 1 ? (
              <Link
                href={feedHref({ child: activeChild, type: activeType, page: page - 1 })}
                className="rounded-full bg-surface px-4 py-2 shadow-sm ring-1 ring-line hover:text-primary"
              >
                ← 최근 사진
              </Link>
            ) : (
              <span />
            )}
            <span className="text-muted">
              {page} / {totalPages}
            </span>
            {page < totalPages ? (
              <Link
                href={feedHref({ child: activeChild, type: activeType, page: page + 1 })}
                className="rounded-full bg-surface px-4 py-2 shadow-sm ring-1 ring-line hover:text-primary"
              >
                지난 사진 →
              </Link>
            ) : (
              <span />
            )}
          </nav>
        )}
      </main>

      {/* 업로드 버튼 임시 숨김 — iCloud 자동 동기화로 사진이 올라오므로 직접 업로드 불필요.
          되살리려면 아래 블록의 false를 지우거나 true로 바꾸면 됨. (/upload 페이지·API는 그대로 유지) */}
      {false && (
        <Link
          href="/upload"
          className="fixed bottom-6 right-1/2 z-20 flex translate-x-1/2 items-center gap-2 rounded-full bg-primary px-6 py-3.5 font-semibold text-white shadow-lg transition hover:bg-primary-hover sm:right-6 sm:translate-x-0"
        >
          <span className="text-lg leading-none">＋</span> 사진 올리기
        </Link>
      )}
    </>
  );
}
