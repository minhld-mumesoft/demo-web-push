import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Web Push Demo",
    short_name: "Push Demo",
    description: "Next.js web push notifications demo with VAPID",
    start_url: "/",
    display: "standalone",
    background_color: "#030712",
    theme_color: "#030712",
    orientation: "portrait",
    icons: [
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
      },
    ],
  };
}
