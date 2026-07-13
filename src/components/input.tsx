import type { InputHTMLAttributes } from "react";

export function Input({
  className = "",
  ...props
}: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={`rounded-ui border-hairline bg-ink-900 text-paper-100 placeholder:text-paper-500 hover:border-ink-700 focus:border-sky h-10 w-full border px-3 text-sm focus:outline-none ${className}`}
      {...props}
    />
  );
}
