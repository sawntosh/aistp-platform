import Link from "next/link";
import { useRouter } from "next/router";
import { BarChart3, BookOpen, GraduationCap, Info, ShieldCheck, Target } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { usePracticeSession } from "../context/PracticeSessionContext";
import { cn } from "../lib/cn";
import ThemeToggle from "./ui/ThemeToggle";
import Button from "./ui/Button";
import UserMenu from "./UserMenu";

// Each section carries its own accent, matching the rest of the app
// (Study = emerald, Test = indigo, everything else = primary blue).
const LINKS = [
  { href: "/study", label: "Study", icon: BookOpen, tone: "study" },
  { href: "/practice", label: "Test", icon: Target, tone: "test" },
  { href: "/dashboard", label: "Analytics", icon: BarChart3, tone: "primary" },
];

const GUEST_LINKS = [
  { href: "/study", label: "Study", icon: BookOpen, tone: "study" },
  { href: "/practice", label: "Test", icon: Target, tone: "test" },
  { href: "/about", label: "About", icon: Info, tone: "primary" },
];

const TONE = {
  primary: {
    active: "border-primary text-primary bg-primary-muted/40",
    idle: "border-transparent text-text-secondary hover:text-primary hover:border-primary/40",
  },
  study: {
    active: "border-study text-study bg-study-muted/50",
    idle: "border-transparent text-text-secondary hover:text-study hover:border-study/40",
  },
  test: {
    active: "border-test text-test bg-test-muted/50",
    idle: "border-transparent text-text-secondary hover:text-test hover:border-test/40",
  },
};

const LOCKED_TITLE = "Finish or end your practice session first";

function Logo({ disabled }) {
  return (
    <span className={cn("flex items-center gap-2.5", disabled && "cursor-not-allowed opacity-50")}>
      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-test text-white shadow-md shadow-primary/25">
        <GraduationCap className="h-[18px] w-[18px]" aria-hidden="true" />
      </span>
      <span className="flex items-baseline gap-2 leading-none">
        <span className="text-body font-bold tracking-tight text-text-primary">AISTP</span>
        <span className="hidden border-l border-primary/20 pl-2 text-caption font-semibold uppercase tracking-wide text-text-muted md:inline">
          ISTQB CTFL Practice
        </span>
      </span>
    </span>
  );
}

function NavTab({ href, label, icon: Icon, tone = "primary", isActive, disabled }) {
  const base =
    "flex items-center gap-1.5 border-b-2 px-3 text-body-sm font-medium transition-colors duration-150";
  const t = TONE[tone] ?? TONE.primary;

  if (disabled) {
    return (
      <span
        title={LOCKED_TITLE}
        className={cn(base, "cursor-not-allowed border-transparent text-text-muted opacity-50")}
      >
        {Icon && <Icon className="h-4 w-4" aria-hidden="true" />}
        {label}
      </span>
    );
  }

  return (
    <Link
      href={href}
      aria-current={isActive ? "page" : undefined}
      className={cn(base, isActive ? t.active : t.idle)}
    >
      {Icon && <Icon className="h-4 w-4" aria-hidden="true" />}
      {label}
    </Link>
  );
}

function Divider() {
  return <span aria-hidden="true" className="mx-2 hidden h-6 w-px self-center bg-border sm:block" />;
}

export default function NavBar({ compact = false }) {
  const router = useRouter();
  const { user, logout } = useAuth();
  const { isActive: isSessionActive } = usePracticeSession();

  function handleLogout() {
    logout();
    router.push("/login");
  }

  // Auth pages are standalone, full-screen designs -- no site chrome.
  if (router.pathname === "/login" || router.pathname === "/register") return null;

  const links =
    user?.role === "admin"
      ? [...LINKS, { href: "/admin", label: "Admin", icon: ShieldCheck, tone: "primary" }]
      : LINKS;

  const isLinkActive = (href) =>
    router.pathname === href || router.pathname.startsWith(`${href}/`);

  return (
    <nav
      className={cn(
        "sticky top-0 z-40 border-b border-border bg-surface/95 backdrop-blur supports-[backdrop-filter]:bg-surface/80",
        // For signed-in users the left Sidebar owns navigation on `sm`+, so
        // this header only shows on mobile.
        compact && "sm:hidden"
      )}
    >
      {/* Certification-portal accent: a thin blue -> indigo -> emerald rule
          tying the three product areas together. */}
      <div aria-hidden="true" className="h-1 w-full bg-gradient-to-r from-primary via-test to-study" />

      <div className="mx-auto flex h-16 max-w-6xl items-stretch justify-between px-4 sm:px-6">
        <div className="flex items-center">
          {isSessionActive ? (
            <span title={LOCKED_TITLE}>
              <Logo disabled />
            </span>
          ) : (
            <Link
              href={user ? "/dashboard" : "/"}
              className="rounded-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              <Logo />
            </Link>
          )}
        </div>

        {user ? (
          <div className="flex items-stretch">
            <div className="hidden items-stretch sm:flex">
              {links.map((link) => (
                <NavTab
                  key={link.href}
                  {...link}
                  disabled={isSessionActive}
                  isActive={isLinkActive(link.href)}
                />
              ))}
            </div>
            <Divider />
            <div className="flex items-center gap-1 self-center">
              <ThemeToggle />
              <UserMenu
                name={user.username}
                onLogout={handleLogout}
                disabled={isSessionActive}
                disabledTitle={LOCKED_TITLE}
              />
            </div>
          </div>
        ) : (
          <div className="flex items-stretch">
            <div className="hidden items-stretch sm:flex">
              {GUEST_LINKS.map((link) => (
                <NavTab key={link.href} {...link} isActive={isLinkActive(link.href)} />
              ))}
            </div>
            <Divider />
            <div className="flex items-center gap-2 self-center">
              <ThemeToggle />
              <Button href="/login" variant="ghost" size="sm">
                Log in
              </Button>
              <Button
                href="/register"
                variant="primary"
                size="sm"
                className="bg-gradient-to-r from-primary to-test shadow-sm shadow-primary/30 hover:opacity-90"
              >
                Register
              </Button>
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}
