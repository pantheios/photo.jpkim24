import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ROLES } from "@/lib/constants";
import { AdminPanel } from "@/components/AdminPanel";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== ROLES.ADMIN) redirect("/");

  const children = await prisma.child.findMany({ orderBy: { birthDate: "asc" } });

  return (
    <>
      <header className="sticky top-0 z-20 border-b border-line bg-cream/90 backdrop-blur">
        <div className="mx-auto flex max-w-xl items-center justify-between px-4 py-3">
          <Link href="/" className="text-sm text-muted hover:text-ink">
            ← 홈
          </Link>
          <span className="font-semibold">관리</span>
          <span className="w-8" />
        </div>
      </header>

      <main className="mx-auto max-w-xl px-4 py-5">
        <AdminPanel
          initialChildren={children.map((c) => ({
            id: c.id,
            name: c.name,
            birthDate: c.birthDate.toISOString(),
          }))}
        />
      </main>
    </>
  );
}
