"use client";

export function ShortText(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      type="text"
      className="rounded-ui border-hairline bg-ink-850 text-paper-100 placeholder:text-paper-500 hover:border-paper-500 focus:border-accent-400 h-10 w-full border px-3 text-sm transition-colors focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
    />
  );
}
