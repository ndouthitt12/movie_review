import type { HTMLAttributes, TableHTMLAttributes } from "react";

export function Table({
  className = "",
  ...props
}: TableHTMLAttributes<HTMLTableElement>) {
  return (
    <div className="border-hairline overflow-x-auto border-y">
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
      className={`border-hairline bg-ink-900 text-paper-500 border-b text-xs tracking-widest uppercase ${className}`}
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
      className={`border-hairline text-paper-300 border-b px-3 py-2 ${className}`}
      {...props}
    />
  );
}
