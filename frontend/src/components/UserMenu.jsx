import { useEffect, useRef, useState } from "react";
import { LogOut } from "lucide-react";
import UserAvatar from "./UserAvatar";
import { cn } from "../lib/cn";

// Clicking the avatar opens a small card with the user's name and a log out
// action -- closes on an outside click, Escape, or after logging out.
export default function UserMenu({
  name,
  onLogout,
  disabled = false,
  disabledTitle,
  openUp = false,
  align = "right",
}) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return undefined;

    function handleClickOutside(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    }
    function handleEscape(e) {
      if (e.key === "Escape") setIsOpen(false);
    }

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [isOpen]);

  function handleLogoutClick() {
    setIsOpen(false);
    onLogout();
  }

  return (
    <div className="relative ml-1" ref={containerRef}>
      <button
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        disabled={disabled}
        title={disabled ? disabledTitle : name}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        className={cn(
          "rounded-full transition-opacity focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
          disabled && "cursor-not-allowed opacity-50"
        )}
      >
        <UserAvatar name={name} />
      </button>

      {isOpen && (
        <div
          role="menu"
          className={cn(
            "absolute z-50 w-56 rounded-lg border border-border bg-surface p-2 shadow-lg animate-fade-in",
            align === "left" ? "left-0" : "right-0",
            openUp ? "bottom-full mb-2" : "top-full mt-2",
            openUp
              ? align === "left"
                ? "origin-bottom-left"
                : "origin-bottom-right"
              : align === "left"
                ? "origin-top-left"
                : "origin-top-right"
          )}
        >
          <div className="flex items-center gap-3 rounded-md px-2 py-2">
            <UserAvatar name={name} size="lg" />
            <span className="truncate text-body-sm font-semibold text-text-primary">{name}</span>
          </div>
          <div className="my-1 border-t border-border" />
          <button
            type="button"
            role="menuitem"
            onClick={handleLogoutClick}
            className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-body-sm font-medium text-text-secondary transition-colors hover:bg-surface-muted hover:text-text-primary"
          >
            <LogOut className="h-4 w-4" aria-hidden="true" />
            Log out
          </button>
        </div>
      )}
    </div>
  );
}
