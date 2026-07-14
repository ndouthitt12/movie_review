import ReactMarkdown from "react-markdown";

export function Markdown({
  children,
  className = "",
}: {
  children: string;
  className?: string;
}) {
  return (
    <div className={`markdown-content ${className}`}>
      <ReactMarkdown
        components={{
          a: ({ children: linkChildren, ...props }) => (
            <a {...props} rel="noreferrer" target="_blank">
              {linkChildren}
            </a>
          ),
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
