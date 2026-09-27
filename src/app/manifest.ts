import type { MetadataRoute } from "next";

// Lets a phone add the site to its home screen with a proper name and icon.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Reeler",
    short_name: "Reeler",
    description: "A private film library, rating notebook, and watch journal.",
    start_url: "/",
    display: "standalone",
    background_color: "#0e141b",
    theme_color: "#141c25",
    icons: [
      { src: "/icon/192", sizes: "192x192", type: "image/png" },
      { src: "/icon/512", sizes: "512x512", type: "image/png" },
    ],
  };
}
