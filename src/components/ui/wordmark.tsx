export function Wordmark({ className = "" }: { className?: string }) {
  return (
    <span
      className={`font-expanded text-paper-100 font-sans text-[1.6rem] leading-none font-extrabold tracking-[-0.02em] ${className}`}
    >
      reeler<span className="text-accent-400">.</span>
    </span>
  );
}
