import type { HTMLAttributes, TableHTMLAttributes } from "react";

export function Table({
  className = "",
  ...props
}: TableHTMLAttributes<HTMLTableElement>) {
  return (
    <div className="border-hairline bg-ink-900 rounded-card overflow-x-auto border">
      <table
        className={`w-full border-collapse text-left text-sm ${className}`}
        {...props}
      />
    </div>
  );
}

export function TableHeader({
  className = "",
  ...props
}: HTMLAttributes<HTMLTableSectionElement>) {
  return (
    <thead
      className={`border-hairline bg-ink-850 text-paper-500 border-b text-xs tracking-widest uppercase ${className}`}
      {...props}
    />
  );
}

export function TableCell({
  className = "",
  ...props
}: HTMLAttributes<HTMLTableCellElement>) {
  return (
    <td
      className={`border-hairline bg-ink-900 text-paper-300 border-b px-4 py-3 last:border-b-0 ${className}`}
      {...props}
    />
  );
}
