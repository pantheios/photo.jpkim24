import Link from "next/link";
import { LogoutButton } from "./LogoutButton";
import { ROLES } from "@/lib/constants";

export function AppHeader({ name, role }: { name: string; role: string }) {
  return (
    <header className="sticky top-0 z-20 border-b border-line bg-cream/90 backdrop-blur">
      <div className="mx-auto flex max-w-xl items-center justify-between px-4 py-3">
        <Link href="/" className="flex items-center gap-2 font-bold">
          <span className="text-xl">🍼</span>
          <span>우리집 사진첩</span>
        </Link>
        <nav className="flex items-center gap-4 text-sm">
          <span className="hidden text-muted sm:inline">{name}</span>
          {role === ROLES.ADMIN && (
            <Link href="/admin" className="text-muted hover:text-ink">
              관리
            </Link>
          )}
          <LogoutButton />
        </nav>
      </div>
    </header>
  );
}
