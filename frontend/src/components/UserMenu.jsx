import { useEffect, useRef, useState } from "react";
import UserAvatar from "./UserAvatar";

// Clicking the avatar opens a small card with the user's name and a log out
// action -- closes on an outside click, Escape, or after logging out.
export default function UserMenu({ name, onLogout, disabled = false, disabledTitle }) {
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
    <div className="relative ml-2" ref={containerRef}>
      <button
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        disabled={disabled}
        title={disabled ? disabledTitle : name}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        className="rounded-full transition-opacity active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <UserAvatar name={name} />
      </button>

      {isOpen && (
        <div
          role="menu"
          className="absolute right-0 top-full z-50 mt-2 w-56 origin-top-right rounded-xl border border-gray-100 bg-white p-2 shadow-lg animate-fade-in"
        >
          <div className="flex items-center gap-3 rounded-lg px-2 py-2">
            <UserAvatar name={name} size="lg" />
            <span className="truncate text-sm font-semibold text-gray-900">{name}</span>
          </div>
          <div className="my-1 border-t border-gray-100" />
          <button
            type="button"
            role="menuitem"
            onClick={handleLogoutClick}
            className="flex w-full items-center rounded-lg px-3 py-2 text-left text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50 hover:text-gray-900 active:scale-[0.98]"
          >
            Log out
          </button>
        </div>
      )}
    </div>
  );
}
