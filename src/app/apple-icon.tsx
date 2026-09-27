import { ImageResponse } from "next/og";
import { BrandMark } from "@/components/ui/brand-mark";

// The icon iOS uses when the site is added to the home screen.

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(<BrandMark size={size.width} />, size);
}
