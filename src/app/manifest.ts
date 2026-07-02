import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Hamo Traders",
    short_name: "Hamo Traders",
    description: "Professional trading diary & analytics",
    start_url: "/dashboard",
    display: "standalone",
    background_color: "#0C0F14",
    theme_color: "#0C0F14",
    orientation: "portrait",
    icons: [
      { src: "/icon", sizes: "32x32", type: "image/png" },
      { src: "/apple-icon", sizes: "180x180", type: "image/png" },
    ],
  };
}
