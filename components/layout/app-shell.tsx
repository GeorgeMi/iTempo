"use client";
import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import { Calendar, Home, Users, Briefcase, BarChart3, Settings, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { LocaleSwitcher } from "@/components/layout/locale-switcher";
import { signOut } from "next-auth/react";

const items = [
  { href: "/dashboard", key: "dashboard", icon: Home },
  { href: "/calendar", key: "calendar", icon: Calendar },
  { href: "/clients", key: "clients", icon: Users },
  { href: "/services", key: "services", icon: Briefcase },
  { href: "/reports", key: "reports", icon: BarChart3 },
  { href: "/settings", key: "settings", icon: Settings },
] as const;

export function AppShell({ children, userEmail }: { children: React.ReactNode; userEmail: string }) {
  const pathname = usePathname();
  const t = useTranslations("nav");
  const tApp = useTranslations("app");

  return (
    <div className="min-h-dvh bg-background">
      {/* Sidebar — desktop */}
      <aside className="fixed inset-y-0 left-0 hidden w-56 border-r border-border md:flex md:flex-col">
        <div className="flex h-14 items-center gap-2 px-5 font-semibold tracking-tight">
          <span className="text-primary">·</span>
          {tApp("name")}
        </div>
        <nav className="flex-1 space-y-px px-2 py-2">
          {items.map(({ href, key, icon: Icon }) => {
            const active = pathname === href || pathname.startsWith(href + "/");
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "group relative flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  active
                    ? "text-foreground"
                    : "text-muted-foreground hover:bg-accent/60 hover:text-foreground",
                )}
              >
                {active && (
                  <span className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-full bg-primary" />
                )}
                <Icon className={cn("h-4 w-4 transition-opacity", active ? "opacity-100" : "opacity-80")} />
                {t(key)}
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-border p-3 space-y-2">
          <div className="flex items-center gap-1">
            <ThemeToggle />
            <LocaleSwitcher />
            <Button
              variant="ghost"
              size="icon-sm"
              className="ml-auto"
              onClick={() => signOut({ callbackUrl: "/" })}
              aria-label={t("signOut")}
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
          <p className="truncate text-[11px] text-muted-foreground px-1">{userEmail}</p>
        </div>
      </aside>

      {/* Top bar — mobile */}
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-border bg-background/80 px-4 backdrop-blur md:hidden">
        <div className="flex items-center gap-1.5 font-semibold tracking-tight">
          <span className="text-primary">·</span>
          {tApp("name")}
        </div>
        <div className="flex items-center gap-1">
          <LocaleSwitcher />
          <ThemeToggle />
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => signOut({ callbackUrl: "/" })}
            aria-label={t("signOut")}
          >
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </header>

      <main className="md:pl-56 pb-20 md:pb-10">
        <div className="mx-auto max-w-6xl p-5 sm:p-8">{children}</div>
      </main>

      {/* Bottom nav — mobile */}
      <nav className="fixed bottom-0 left-0 right-0 z-30 border-t border-border bg-background/95 backdrop-blur md:hidden">
        <div className="grid grid-cols-6">
          {items.map(({ href, key, icon: Icon }) => {
            const active = pathname === href || pathname.startsWith(href + "/");
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "flex flex-col items-center justify-center gap-0.5 py-2.5 text-[10px] font-medium transition-colors",
                  active ? "text-foreground" : "text-muted-foreground",
                )}
              >
                <Icon className={cn("h-5 w-5", active && "text-primary")} />
                {t(key)}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
