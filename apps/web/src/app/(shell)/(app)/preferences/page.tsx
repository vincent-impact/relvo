import type { Metadata } from "next";
import { RelvoHeader } from "@/components/layout/relvo-header";
import { Screen } from "@/components/layout/screen";
import { PreferencesToggles } from "@/components/settings/preferences-toggles";
import { requireAccount } from "@/server/auth-context";

export const metadata: Metadata = { title: "Préférences — Relvo" };

// Préférences — page du menu (M18) : ce que Relvo fait de lui-même sur le
// compte, à commencer par l'interrupteur de l'assistant.

export default async function PreferencesPage() {
  const account = await requireAccount();
  return (
    <Screen>
      <RelvoHeader
        title="Préférences"
        subtitle="Ce que Relvo fait de lui-même"
        className="pb-5"
      />
      <div className="px-4 pt-5">
        <PreferencesToggles assistantEnabled={account.assistantEnabled} />
      </div>
    </Screen>
  );
}
