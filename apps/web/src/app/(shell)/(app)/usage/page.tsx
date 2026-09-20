import type { Metadata } from "next";
import { RelvoHeader } from "@/components/layout/relvo-header";
import { Screen } from "@/components/layout/screen";
import { UsagePane } from "@/components/settings/usage-pane";
import { requireAccount } from "@/server/auth-context";

export const metadata: Metadata = { title: "Usage — Relvo" };

// Usage — page du menu (M18) : la part du plafond mensuel consommée, en
// pourcentage, jamais en euros (invariant 38). Maquette annoncée jusqu'au
// plafond par compte (M14.5).

export default async function UsagePage() {
  await requireAccount();
  return (
    <Screen>
      <RelvoHeader
        title="Usage"
        subtitle="Votre part du plafond mensuel"
        className="pb-5"
      />
      <UsagePane />
    </Screen>
  );
}
