import type { MetadataRoute } from "next";

/** PWA manifest — installable on Android/iOS home screens. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "GigFlow",
    short_name: "GigFlow",
    description:
      "Track earnings, expenses, mileage, and offers for rideshare and delivery work.",
    start_url: "/dashboard",
    display: "standalone",
    background_color: "#0b0b0f",
    theme_color: "#0B8A80",
    icons: [
      { src: "/icon.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icon.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
