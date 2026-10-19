import type { Metadata } from "next";
import { DicteeEssai } from "@/components/admin/dictee-essai";
import { RelvoHeader } from "@/components/layout/relvo-header";
import { Screen } from "@/components/layout/screen";

export const metadata: Metadata = { title: "Essai de dictée — Relvo" };
export const dynamic = "force-dynamic";

// L'essai de dictée (M22.1) — une page du backoffice, donc réservée au rôle
// `admin` (layout de la zone) : le micro en PWA installée s'éprouve ici le
// premier jour, avec le code qui servira au composer, et les dictées du
// benchmark en sortent par la feuille de partage.

export default function AdminDicteePage() {
  return (
    <Screen bottomInset={12}>
      <RelvoHeader
        back="/admin"
        title="Essai de dictée"
        subtitle="le micro, la transcription, la mesure"
        className="pb-9"
      />
      <div className="relative z-3 -mt-5">
        <DicteeEssai />
      </div>
    </Screen>
  );
}
