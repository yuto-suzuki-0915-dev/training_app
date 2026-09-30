import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "LOGBOOK | 筋トレ記録",
    short_name: "LOGBOOK",
    description: "ジムでのトレーニングを素早く記録するアプリ",
    start_url: "/",
    display: "standalone",
    background_color: "#f5f7f4",
    theme_color: "#1d4136",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  };
}
