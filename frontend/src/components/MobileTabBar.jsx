import Link from "next/link";
import { useRouter } from "next/router";
import { BarChart3, BookOpen, Target } from "lucide-react";
import { usePracticeSession } from "../context/PracticeSessionContext";
import { cn } from "../lib/cn";

const TABS = [
  { href: "/study", label: "Study", icon: BookOpen },
  { href: "/practice", label: "Exam", icon: Target },
  { href: "/dashboard", label: "Progress", icon: BarChart3 },
];

// Compact bottom tab bar for authenticated users on small screens -- the
// top NavBar hides its link row below `sm`, so this is primary mobile nav.
export default function MobileTabBar() {
  const router = useRouter();
  const { isActive: isSessionActive } = usePracticeSession();

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-surface/95 backdrop-blur pb-[env(safe-area-inset-bottom)] sm:hidden">
      <div className="flex items-center justify-around px-2 py-1.5">
        {TABS.map(({ href, label, icon: Icon }) => {
          const isActive = router.pathname === href || router.pathname.startsWith(`${href}/`);
          return (
            <Link
              key={href}
              href={isSessionActive ? router.pathname : href}
              aria-disabled={isSessionActive}
              title={isSessionActive ? "Finish or end your practice session first" : undefined}
              className={cn(
                "flex min-w-[64px] flex-col items-center gap-1 rounded-md px-3 py-1.5 text-caption font-medium transition-colors",
                isSessionActive
                  ? "cursor-not-allowed text-text-muted opacity-50"
                  : isActive
                    ? "text-primary"
                    : "text-text-muted hover:text-text-primary"
              )}
            >
              <Icon className="h-5 w-5" aria-hidden="true" />
              {label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
