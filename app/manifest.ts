import type { MetadataRoute } from "next";

export const dynamic = "force-static";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Solitär – Klondike Solitaire",
    short_name: "Solitär",
    description:
      "Klondike Solitär kostenlos im Browser spielen. Draw 1 oder Draw 3.",
    start_url: "/",
    display: "standalone",
    background_color: "#064d27",
    theme_color: "#0b6b3a",
    orientation: "any",
    categories: ["games", "entertainment"],
    icons: [
      {
        src: "/favicon.ico",
        sizes: "16x16 32x32 48x48",
        type: "image/x-icon",
      },
      {
        src: "/icon.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/apple-icon.png",
        sizes: "180x180",
        type: "image/png",
      },
    ],
  };
}
