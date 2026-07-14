export function Wordmark({ className = "" }: { className?: string }) {
  return (
    <span
      className={`font-serif text-2xl font-semibold tracking-[-0.035em] ${className}`}
    >
      <span className="text-paper-100">Picture</span>
      <span className="text-accent-400">House</span>
    </span>
  );
}
