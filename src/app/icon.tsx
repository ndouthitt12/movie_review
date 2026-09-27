import { ImageResponse } from "next/og";
import { BrandMark } from "@/components/ui/brand-mark";

// Home-screen and install icons. The manifest links to /icon/192 and
// /icon/512. favicon.ico still serves the browser tab.

export function generateImageMetadata() {
  return [192, 512].map((size) => ({
    id: String(size),
    size: { width: size, height: size },
    contentType: "image/png",
  }));
}

export default async function Icon({ id }: { id: Promise<string> }) {
  const size = Number(await id);
  return new ImageResponse(<BrandMark size={size} />, {
    width: size,
    height: size,
  });
}
