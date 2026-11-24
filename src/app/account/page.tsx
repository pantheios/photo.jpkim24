import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { AccountPanel } from "@/components/AccountPanel";

export const dynamic = "force-dynamic";

export default async function AccountPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return (
    <>
      <header className="sticky top-0 z-20 border-b border-line bg-cream/90 backdrop-blur">
        <div className="mx-auto flex max-w-xl items-center justify-between px-4 py-3">
          <Link href="/" className="text-sm text-muted hover:text-ink">
            ← 홈
          </Link>
          <span className="font-semibold">내 계정</span>
          <span className="w-8" />
        </div>
      </header>

      <main className="mx-auto max-w-xl space-y-6 px-4 py-5">
        <section className="rounded-card bg-surface p-5 shadow-sm ring-1 ring-line">
          <h2 className="mb-3 font-bold">👤 내 정보</h2>
          <dl className="space-y-1.5 text-sm">
            <div className="flex gap-3">
              <dt className="w-16 shrink-0 text-muted">이름</dt>
              <dd>{user.name}</dd>
            </div>
            <div className="flex gap-3">
              <dt className="w-16 shrink-0 text-muted">이메일</dt>
              <dd>{user.email}</dd>
            </div>
            <div className="flex gap-3">
              <dt className="w-16 shrink-0 text-muted">권한</dt>
              <dd>{user.role === "admin" ? "관리자" : "구성원"}</dd>
            </div>
          </dl>
        </section>

        <AccountPanel />
      </main>
    </>
  );
}
