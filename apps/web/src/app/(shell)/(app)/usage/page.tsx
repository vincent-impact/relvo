import type { Metadata } from "next";
import { RelvoHeader } from "@/components/layout/relvo-header";
import { Screen } from "@/components/layout/screen";
import { UsagePane } from "@/components/settings/usage-pane";
import { pourcentDuQuota } from "@/lib/medias";
import { requireAccount } from "@/server/auth-context";
import { espaceDuCompte } from "@/server/depot";

export const metadata: Metadata = { title: "Usage — Relvo" };

// Usage — page du menu (M18) : la part du plafond mensuel consommée, en
// pourcentage, jamais en euros (invariant 38). Maquette annoncée jusqu'au
// plafond par compte (M14.5). L'ESPACE, lui, est réel (M25.7) : la part du
// quota de stockage du compte, lue de la même mesure que la garde.

export default async function UsagePage() {
  const account = await requireAccount();
  const espace = await espaceDuCompte(account.id);
  return (
    <Screen>
      {/* Pas de sous-titre : « Ce mois-ci » et la phrase du plafond le disent. */}
      <RelvoHeader title="Usage" className="pb-9" />
      <UsagePane
        espace={{ pourcent: pourcentDuQuota(espace.part), plein: espace.plein }}
      />
    </Screen>
  );
}
