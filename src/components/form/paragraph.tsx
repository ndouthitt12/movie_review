"use client";

export function Paragraph(
  props: React.TextareaHTMLAttributes<HTMLTextAreaElement>,
) {
  return (
    <textarea
      {...props}
      rows={4}
      className="rounded-ui border-hairline bg-ink-850 text-paper-100 placeholder:text-paper-500 hover:border-paper-500 focus:border-accent-400 w-full resize-y border p-3 text-sm leading-6 transition-colors focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
    />
  );
}
