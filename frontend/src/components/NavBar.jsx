import Link from "next/link";
import { useRouter } from "next/router";
import { BarChart3, BookOpen, Info, ShieldCheck, Target } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { usePracticeSession } from "../context/PracticeSessionContext";
import { cn } from "../lib/cn";
import ThemeToggle from "./ui/ThemeToggle";
import Button from "./ui/Button";
import UserMenu from "./UserMenu";

const LINKS = [
  { href: "/study", label: "Study", icon: BookOpen },
  { href: "/practice", label: "Test", icon: Target },
  { href: "/dashboard", label: "Analytics", icon: BarChart3 },
];

const LOCKED_TITLE = "Finish or end your practice session first";

function Logo({ disabled }) {
  return (
    <span
      className={cn(
        "flex items-center gap-2 text-body font-semibold tracking-tight text-text-primary",
        disabled && "cursor-not-allowed opacity-50"
      )}
    >
      <span className="flex h-7 w-7 items-center justify-center rounded-md bg-primary text-body-sm font-bold text-primary-foreground">
        A
      </span>
      AISTP
    </span>
  );
}

function NavLink({ href, label, icon: Icon, isActive, disabled }) {
  if (disabled) {
    return (
      <span
        title={LOCKED_TITLE}
        className="flex cursor-not-allowed items-center gap-1.5 rounded-md px-3 py-1.5 text-body-sm font-medium text-text-muted opacity-50"
      >
        {Icon && <Icon className="h-4 w-4" aria-hidden="true" />}
        {label}
      </span>
    );
  }
  return (
    <Link
      href={href}
      className={cn(
        "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-body-sm font-medium transition-colors duration-150",
        isActive ? "bg-primary-muted text-primary" : "text-text-secondary hover:bg-surface-muted hover:text-text-primary"
      )}
    >
      {Icon && <Icon className="h-4 w-4" aria-hidden="true" />}
      {label}
    </Link>
  );
}

export default function NavBar() {
  const router = useRouter();
  const { user, logout } = useAuth();
  const { isActive: isSessionActive } = usePracticeSession();

  function handleLogout() {
    logout();
    router.push("/login");
  }

  // Auth pages are standalone, full-screen designs -- no site chrome.
  if (router.pathname === "/login" || router.pathname === "/register") return null;

  const links = user?.role === "admin" ? [...LINKS, { href: "/admin", label: "Admin", icon: ShieldCheck }] : LINKS;

  return (
    <nav className="sticky top-0 z-40 border-b border-border bg-surface/95 backdrop-blur supports-[backdrop-filter]:bg-surface/80">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
        {isSessionActive ? (
          <span title={LOCKED_TITLE}>
            <Logo disabled />
          </span>
        ) : (
          <Link href={user ? "/dashboard" : "/"}>
            <Logo />
          </Link>
        )}

        {user ? (
          <div className="flex items-center gap-1">
            <div className="hidden items-center gap-1 sm:flex">
              {links.map((link) => (
                <NavLink
                  key={link.href}
                  {...link}
                  disabled={isSessionActive}
                  isActive={router.pathname === link.href || router.pathname.startsWith(`${link.href}/`)}
                />
              ))}
              <NavLink href="/about" label="About" icon={Info} disabled={isSessionActive} isActive={router.pathname === "/about"} />
            </div>
            <ThemeToggle className="ml-1" />
            <UserMenu name={user.username} onLogout={handleLogout} disabled={isSessionActive} disabledTitle={LOCKED_TITLE} />
          </div>
        ) : (
          <div className="flex items-center gap-1 sm:gap-2">
            <div className="hidden items-center gap-1 sm:flex">
              <NavLink href="/study" label="Study" icon={BookOpen} isActive={router.pathname.startsWith("/study")} />
              <NavLink href="/practice" label="Test" icon={Target} isActive={router.pathname === "/practice"} />
              <NavLink href="/about" label="About" icon={Info} isActive={router.pathname === "/about"} />
            </div>
            <ThemeToggle />
            <Button href="/login" variant="ghost" size="sm">
              Log in
            </Button>
            <Button href="/register" variant="primary" size="sm">
              Register
            </Button>
          </div>
        )}
      </div>
    </nav>
  );
}
