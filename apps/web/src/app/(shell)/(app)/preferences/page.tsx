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
        className="pb-9"
      />
      <div className="relative z-3 -mt-5 px-4">
        <PreferencesToggles assistantEnabled={account.assistantEnabled} />
      </div>
    </Screen>
  );
}
