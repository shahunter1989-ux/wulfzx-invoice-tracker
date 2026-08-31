import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "WZXU Invoice Tracker",
    short_name: "WZXU",
    description: "Private invoice, payment, receipt, and business tracking app for WZXU.",
    start_url: "/dashboard",
    scope: "/",
    display: "standalone",
    background_color: "#05070b",
    theme_color: "#0ea5e9",
    categories: ["business", "productivity", "finance"],
    icons: [
      {
        src: "/icons/wzxu-icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any"
      },
      {
        src: "/icons/wzxu-icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any"
      },
      {
        src: "/icons/wzxu-maskable-icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable"
      },
      {
        src: "/icons/wzxu-icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any"
      },
      {
        src: "/icons/wzxu-maskable-icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "maskable"
      }
    ],
    screenshots: [
      {
        src: "/wulfzx-background.png",
        sizes: "1024x1024",
        type: "image/png",
        form_factor: "wide",
        label: "WZXU Invoice Tracker brand background"
      }
    ]
  };
}
