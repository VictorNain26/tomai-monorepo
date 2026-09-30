import type { MetadataRoute } from "next";
import { BRAND_NAME } from "@/lib/brand";

// Manifest colors can't read CSS variables: copied from packages/tokens/theme.css.
const PAPER = "#FAF7F0";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: BRAND_NAME,
    short_name: BRAND_NAME,
    description: "L'IA qui aide les collégiens à comprendre leurs devoirs, de la 6e à la 3e.",
    start_url: "/",
    display: "standalone",
    background_color: PAPER,
    theme_color: PAPER,
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  };
}
