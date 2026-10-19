import type { Metadata } from "next";
import { RelvoHeader } from "@/components/layout/relvo-header";
import { Screen } from "@/components/layout/screen";
import { NotificationsToggle } from "@/components/settings/notifications-toggle";
import { PreferencesToggles } from "@/components/settings/preferences-toggles";
import { requireAccount } from "@/server/auth-context";
import { clePubliquePush } from "@/server/push/envoyer";

export const metadata: Metadata = { title: "Préférences — Relvo" };

// Préférences — page du menu (M18) : ce que Relvo fait de lui-même sur le
// compte — l'interrupteur de l'assistant —, et ce qu'il peut faire sur cet
// appareil — les notifications (M12.7, M12.9), un abonnement par appareil.

export default async function PreferencesPage() {
  const account = await requireAccount();
  return (
    <Screen>
      <RelvoHeader
        title="Préférences"
        subtitle="Ce que Relvo fait de lui-même"
        className="pb-9"
      />
      <div className="relative z-3 -mt-5 flex flex-col gap-3 px-4">
        <PreferencesToggles assistantEnabled={account.assistantEnabled} />
        <NotificationsToggle clePublique={clePubliquePush()} />
      </div>
    </Screen>
  );
}
