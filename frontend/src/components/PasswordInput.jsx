import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { cn } from "../lib/cn";

const DEFAULT_INPUT_CLASS =
  "h-10 w-full rounded-md border border-border-strong bg-surface px-3 pr-10 text-body text-text-primary placeholder:text-text-muted transition-colors duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";

export default function PasswordInput({
  id,
  name,
  value,
  onChange,
  autoComplete,
  required = true,
  placeholder,
  minLength,
  inputClassName,
}) {
  const [isVisible, setIsVisible] = useState(false);

  return (
    <div className="relative">
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
        className={cn(inputClassName ?? DEFAULT_INPUT_CLASS)}
      />
      <button
        type="button"
        onClick={() => setIsVisible((v) => !v)}
        tabIndex={-1}
        aria-label={isVisible ? "Hide password" : "Show password"}
        className="absolute inset-y-0 right-0 flex items-center px-3 text-text-muted transition-colors hover:text-text-secondary"
      >
        {isVisible ? <EyeOff className="h-4 w-4" aria-hidden="true" /> : <Eye className="h-4 w-4" aria-hidden="true" />}
      </button>
    </div>
  );
}
