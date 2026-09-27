/**
 * The "r." of the wordmark on the header colour, for app icons rendered by
 * next/og. It uses inline styles because ImageResponse has no Tailwind.
 */
export function BrandMark({ size }: { size: number }) {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#141c25",
        color: "#e9e6df",
        fontSize: size * 0.62,
        fontWeight: 800,
        letterSpacing: "-0.04em",
        // Optical centring: the glyphs sit low in their box.
        paddingBottom: size * 0.08,
      }}
    >
      r<span style={{ color: "#ff8f6b" }}>.</span>
    </div>
  );
}
