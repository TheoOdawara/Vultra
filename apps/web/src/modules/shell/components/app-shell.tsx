"use client";

import { MenuIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import type { Role } from "@/shared/auth/guards";
import { activeHrefFor, NAVIGATION } from "@/shared/navigation/navigation";
import { Button } from "@/shared/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/shared/ui/sheet";

const NAV_LABEL = "Navegação principal";

function NavTree({
  role,
  activeHref,
  onNavigate,
}: {
  role: Role;
  activeHref: string | null;
  onNavigate?: () => void;
}) {
  return (
    <div className="grid gap-6">
      {NAVIGATION[role].map((group) => (
        <div key={group.label ?? "principal"} className="grid gap-1">
          {group.label === null ? null : (
            <p className="px-3 text-xs font-medium text-muted uppercase">{group.label}</p>
          )}
          <ul className="grid gap-1">
            {group.items.map((item) => (
              <li key={item.href}>
                <Link
                  aria-current={item.href === activeHref ? "page" : undefined}
                  className="flex min-h-11 items-center rounded-md px-3 text-sm text-foreground hover:bg-accent aria-[current=page]:bg-accent aria-[current=page]:font-medium"
                  href={item.href}
                  onClick={onNavigate}
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

export function AppShell({
  viewerRole,
  children,
}: {
  viewerRole: Role | null;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [isSheetOpen, setSheetOpen] = useState(false);

  if (viewerRole === null) {
    return <main className="min-h-screen p-4 md:p-6">{children}</main>;
  }

  const activeHref = activeHrefFor(viewerRole, pathname);

  return (
    <div className="min-h-screen md:grid md:grid-cols-[16rem_1fr]">
      <header className="flex items-center gap-2 border-border border-b p-2 md:hidden">
        <Sheet onOpenChange={setSheetOpen} open={isSheetOpen}>
          <SheetTrigger asChild>
            <Button aria-label="Abrir navegação" size="icon-lg" variant="ghost">
              <MenuIcon aria-hidden="true" />
            </Button>
          </SheetTrigger>
          <SheetContent className="p-4" side="left">
            <SheetHeader className="p-0">
              <SheetTitle>Vultra</SheetTitle>
            </SheetHeader>
            <nav aria-label={NAV_LABEL}>
              <NavTree
                activeHref={activeHref}
                onNavigate={() => setSheetOpen(false)}
                role={viewerRole}
              />
            </nav>
          </SheetContent>
        </Sheet>
        <span className="font-semibold text-foreground">Vultra</span>
      </header>

      <aside className="hidden border-border border-r p-4 md:block">
        <p className="mb-6 px-3 font-semibold text-foreground">Vultra</p>
        <nav aria-label={NAV_LABEL}>
          <NavTree activeHref={activeHref} role={viewerRole} />
        </nav>
      </aside>

      <main className="p-4 md:p-6">{children}</main>
    </div>
  );
}
