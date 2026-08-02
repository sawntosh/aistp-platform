import { useState } from "react";

const DEFAULT_INPUT_CLASS =
  "w-full rounded-md border border-gray-300 px-3 py-2 pr-10 text-sm transition-colors focus:border-amber-400 focus:outline-none focus:ring-1 focus:ring-amber-400";

export default function PasswordInput({
  id,
  name,
  value,
  onChange,
  autoComplete,
  required = true,
  placeholder,
  minLength,
  inputClassName = DEFAULT_INPUT_CLASS,
}) {
  const [isVisible, setIsVisible] = useState(false);

  return (
    <div className="relative mt-1">
      <input
        id={id}
        name={name}
        type={isVisible ? "text" : "password"}
        required={required}
        autoComplete={autoComplete}
        placeholder={placeholder}
        minLength={minLength}
        value={value}
        onChange={onChange}
        className={inputClassName}
      />
      <button
        type="button"
        onClick={() => setIsVisible((v) => !v)}
        tabIndex={-1}
        aria-label={isVisible ? "Hide password" : "Show password"}
        className="absolute inset-y-0 right-0 flex items-center px-3 text-gray-400 transition-colors hover:text-gray-600"
      >
        {isVisible ? (
          <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
            <path d="M3.28 2.22a.75.75 0 0 0-1.06 1.06l14.5 14.5a.75.75 0 1 0 1.06-1.06l-1.745-1.745a10.29 10.29 0 0 0 3.296-4.176.75.75 0 0 0 0-.576A10.75 10.75 0 0 0 10 3.5c-1.363 0-2.656.29-3.822.812l-2.898-2.9Zm7.007 7.007-2.523-2.523A3 3 0 0 1 10 7a3 3 0 0 1 3.002 3l-.001.07a3.003 3.003 0 0 1-2.714 2.723Z" />
            <path d="M10 12.5c-.28 0-.552-.028-.816-.08l1.079 1.079c-.087.001-.174.001-.263.001-3.867 0-7.144-2.325-8.594-5.66a.75.75 0 0 1 0-.576 10.766 10.766 0 0 1 2.288-3.322l1.09 1.09A9.264 9.264 0 0 0 3.16 7.5c1.36 2.822 4.148 4.75 7.34 4.75.28 0 .553-.014.822-.043l-1.322-1.323V12.5Z" />
          </svg>
        ) : (
          <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
            <path d="M10 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z" />
            <path
              fillRule="evenodd"
              d="M.664 10.59a1.651 1.651 0 0 1 0-1.18C1.79 6.06 5.6 3.5 10 3.5s8.21 2.56 9.336 5.91a1.651 1.651 0 0 1 0 1.18C18.21 13.94 14.4 16.5 10 16.5S1.79 13.94.664 10.59ZM14 10a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z"
              clipRule="evenodd"
            />
          </svg>
        )}
      </button>
    </div>
  );
}
