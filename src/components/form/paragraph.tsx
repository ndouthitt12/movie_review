"use client";

export function Paragraph(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} rows={4} className="input-field w-full resize-y" />;
}
