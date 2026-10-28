import type { Metadata } from "next";
import { fontClassNames } from "../fonts";
import "../globals.css";

// Layout RACINE des pages PUBLIQUES — le groupe `(public)`.
//
// Ces pages sont vues HORS de l'application, sans session : le suivi client,
// et le SITE (M24.10) — la présentation sur `relvo.net` et les pages légales,
// que Google lit pour vérifier l'application. Elles n'héritent volontairement de RIEN de la coquille de
// `(shell)` — ni métadonnées PWA, ni blocage du zoom, ni verrou portrait, ni
// hauteur de cadre, ni garde anti-rebond, ni fournisseur de session. Le
// document défile normalement, le lecteur zoome et tourne son téléphone.
//
// ⚠️ Ne pas y ajouter un garde « parce que l'application l'a » : c'est
// précisément ce qui a rendu le suivi indéfilable sur mobile (PITFALLS #48).
// Seules les polices et la feuille globale sont partagées (`../fonts`).

// Pas de `robots` ici : le site se laisse lire et indexer ; le suivi client,
// lui, pose son propre `noindex` dans sa page.
export const metadata: Metadata = {
  title: "Relvo",
};

export default function PublicLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr" className={`${fontClassNames} h-full antialiased`}>
      <body className="min-h-full">{children}</body>
    </html>
  );
}
