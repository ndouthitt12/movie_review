export function Wordmark({ className = "" }: { className?: string }) {
  return (
    <span
      className={`font-serif text-[2.15rem] leading-none font-semibold tracking-[-0.045em] ${className}`}
    >
      <span className="text-accent-400">Reeler</span>
    </span>
  );
}
