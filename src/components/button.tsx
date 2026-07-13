import { forwardRef, type ButtonHTMLAttributes } from "react";

export const Button = forwardRef<
  HTMLButtonElement,
  ButtonHTMLAttributes<HTMLButtonElement>
>(function Button({ className = "", ...props }, ref) {
  return (
    <button
      ref={ref}
      className={`rounded-ui border-accent-500 bg-accent-500 text-paper-100 hover:border-accent-400 hover:bg-accent-400 inline-flex min-h-9 items-center justify-center border px-4 text-sm font-medium transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-40 ${className}`}
      {...props}
    />
  );
});

export const QuietButton = forwardRef<
  HTMLButtonElement,
  ButtonHTMLAttributes<HTMLButtonElement>
>(function QuietButton({ className = "", ...props }, ref) {
  return (
    <button
      ref={ref}
      className={`rounded-ui border-hairline text-paper-300 hover:border-paper-500 hover:text-paper-100 inline-flex min-h-9 items-center justify-center border bg-transparent px-4 text-sm font-medium transition-colors duration-150 ${className}`}
      {...props}
    />
  );
});
