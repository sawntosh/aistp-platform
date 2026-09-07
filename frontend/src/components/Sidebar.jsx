import Link from "next/link";
import { useRouter } from "next/router";
import { BarChart3, BookOpen, ShieldCheck, Target } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { usePracticeSession } from "../context/PracticeSessionContext";
import { cn } from "../lib/cn";
import ThemeToggle from "./ui/ThemeToggle";
import UserMenu from "./UserMenu";

export const SIDEBAR_WIDTH_CLASS = "sm:pl-60";

const LINKS = [
  { href: "/study", label: "Study Mode", icon: BookOpen },
  { href: "/practice", label: "Real Exam", icon: Target },
  { href: "/dashboard", label: "Analytics", icon: BarChart3 },
];

const LOCKED_TITLE = "Finish or end your practice session first";

function LogoMark({ disabled = false }) {
  return (
    <span className={cn("flex items-center gap-2.5", disabled && "cursor-not-allowed opacity-50")}>
      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-body-sm font-bold text-primary-foreground">
        A
      </span>
      <span className="flex flex-col leading-tight">
        <span className="text-body-sm font-semibold tracking-tight text-text-primary">AISTP</span>
        <span className="text-caption text-text-muted">CTFL Practice Platform</span>
      </span>
    </span>
  );
}

// Fixed left navigation for signed-in users on `sm` and up. Below `sm` it
// hides and MobileTabBar + the compact NavBar header take over (see _app).
export default function Sidebar() {
  const router = useRouter();
  const { user, logout } = useAuth();
  const { isActive: isSessionActive } = usePracticeSession();

  if (!user) return null;
  if (router.pathname === "/login" || router.pathname === "/register") return null;

  function handleLogout() {
    logout();
    router.push("/login");
  }

  const links =
    user.role === "admin"
      ? [...LINKS, { href: "/admin", label: "Admin", icon: ShieldCheck }]
      : LINKS;

  return (
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-60 flex-col border-r border-border bg-surface sm:flex">
      <div className="px-5 py-4">
        {isSessionActive ? (
          <span title={LOCKED_TITLE}>
            <LogoMark disabled />
          </span>
        ) : (
          <Link href="/dashboard" className="inline-flex">
            <LogoMark />
          </Link>
        )}
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-2">
        {links.map(({ href, label, icon: Icon }) => {
          const isActive = router.pathname === href || router.pathname.startsWith(`${href}/`);

          if (isSessionActive) {
            return (
              <span
                key={href}
                title={LOCKED_TITLE}
                className="flex cursor-not-allowed items-center gap-3 rounded-lg px-3 py-2 text-body-sm font-medium text-text-muted opacity-50"
              >
                <Icon className="h-[18px] w-[18px]" aria-hidden="true" />
                {label}
              </span>
            );
          }

          return (
            <Link
              key={href}
              href={href}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-body-sm font-medium transition-colors duration-150",
                isActive
                  ? "bg-primary-muted text-primary"
                  : "text-text-secondary hover:bg-surface-muted hover:text-text-primary"
              )}
            >
              <Icon className="h-[18px] w-[18px]" aria-hidden="true" />
              {label}
            </Link>
          );
        })}
      </nav>

      <div className="flex items-center gap-2 border-t border-border px-4 py-3">
        <UserMenu
          name={user.username}
          onLogout={handleLogout}
          disabled={isSessionActive}
          disabledTitle={LOCKED_TITLE}
          openUp
          align="left"
        />
        <div className="min-w-0 flex-1">
          <p className="truncate text-body-sm font-medium text-text-primary">{user.username}</p>
          <p className="truncate text-caption capitalize text-text-muted">
            {user.role === "admin" ? "Admin" : "Learner"}
          </p>
        </div>
        <ThemeToggle />
      </div>
    </aside>
  );
}
