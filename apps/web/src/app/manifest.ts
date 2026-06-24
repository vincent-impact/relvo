import type { MetadataRoute } from "next";

// Manifest PWA (servi sur /manifest.webmanifest). `display: standalone` =
// app plein écran sans chrome navigateur une fois installée. ⚠️ iOS n'accorde le
// standalone qu'au « Sur l'écran d'accueil » de **Safari** (pas Chrome/Firefox iOS,
// tous WebKit mais bridés). Icônes 192/512 = exigence d'installabilité Chrome.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Relvo",
    short_name: "Relvo",
    description:
      "Assistant IA de pilotage des sollicitations professionnelles.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#ffffff",
    theme_color: "#6b5bd6",
    lang: "fr",
    icons: [
      { src: "/relvo-icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/relvo-icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  };
}
