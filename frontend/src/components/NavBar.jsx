import Link from "next/link";
import { useRouter } from "next/router";
import { useAuth } from "../context/AuthContext";

const LINKS = [
  { href: "/practice", label: "Practice" },
  { href: "/dashboard", label: "Analytics" },
];

export default function NavBar() {
  const router = useRouter();
  const { user, logout } = useAuth();

  function handleLogout() {
    logout();
    router.push("/login");
  }

  const links = user?.role === "admin" ? [...LINKS, { href: "/admin", label: "Admin" }] : LINKS;

  // Auth pages are standalone, full-screen designs -- no site chrome.
  if (router.pathname === "/login" || router.pathname === "/register") return null;

  return (
    <nav className="border-b border-gray-200 bg-white">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
        <Link
          href={user ? "/practice" : "/"}
          className="bg-gradient-to-r from-indigo-600 via-violet-600 to-fuchsia-600 bg-clip-text text-sm font-bold text-transparent"
        >
          AISTP
        </Link>

        {user ? (
          <div className="flex items-center gap-1">
            {links.map((link) => {
              const isActive = router.pathname === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                    isActive
                      ? "bg-indigo-50 text-indigo-700"
                      : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}
            <button
              type="button"
              onClick={handleLogout}
              className="ml-2 rounded-md px-3 py-1.5 text-sm font-medium text-gray-500 transition-colors hover:bg-gray-50 hover:text-gray-900 active:scale-95"
            >
              Log out
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <Link
              href="/practice"
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                router.pathname === "/practice"
                  ? "bg-indigo-50 text-indigo-700"
                  : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
              }`}
            >
              Practice
            </Link>
            <Link
              href="/login"
              className="rounded-md px-3 py-1.5 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50 hover:text-gray-900"
            >
              Log in
            </Link>
            <Link
              href="/register"
              className="rounded-md bg-gradient-to-r from-indigo-600 to-violet-600 px-3 py-1.5 text-sm font-medium text-white shadow-sm transition-all hover:from-indigo-500 hover:to-violet-500 active:scale-95"
            >
              Register
            </Link>
          </div>
        )}
      </div>
    </nav>
  );
}