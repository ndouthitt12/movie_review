import { forwardRef, type ButtonHTMLAttributes } from "react";

export const Button = forwardRef<
  HTMLButtonElement,
  ButtonHTMLAttributes<HTMLButtonElement>
>(function Button({ className = "", ...props }, ref) {
  return (
    <button
      ref={ref}
      className={`rounded-ui border-accent-400 bg-accent-400 text-ink-950 hover:border-accent-500 hover:bg-accent-500 inline-flex min-h-10 items-center justify-center border px-4 text-sm font-bold transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-40 ${className}`}
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
      className={`rounded-ui border-hairline bg-ink-850 text-paper-300 hover:border-accent-500 hover:text-paper-100 inline-flex min-h-10 items-center justify-center border px-4 text-sm font-medium transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-40 ${className}`}
      {...props}
    />
  );
});

export const GhostButton = forwardRef<
  HTMLButtonElement,
  ButtonHTMLAttributes<HTMLButtonElement>
>(function GhostButton({ className = "", ...props }, ref) {
  return (
    <button
      ref={ref}
      className={`text-accent-400 hover:text-accent-300 inline-flex min-h-10 items-center justify-center px-2 text-sm font-medium transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-40 ${className}`}
      {...props}
    />
  );
});
