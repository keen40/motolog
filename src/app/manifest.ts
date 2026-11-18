import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "MotoLog",
    short_name: "MotoLog",
    description: "Service, modification and parts log for your motorcycles",
    start_url: "/garage",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#0c0c0e",
    theme_color: "#0c0c0e",
    icons: [
      { src: "/pwa-icon/any-192", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/pwa-icon/any-512", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/pwa-icon/maskable-512", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
