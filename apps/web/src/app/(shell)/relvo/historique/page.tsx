import { MobileFrame } from "@/components/layout/mobile-frame";
import { RelvoHeader } from "@/components/layout/relvo-header";
import { HistoriqueLocal } from "@/components/relvo-chat/historique-local";
import { requireAccount } from "@/server/auth-context";

// Historique des ÉCHANGES avec Relvo (M10.4) : les échanges passés du
// dirigeant, éphémères, en IndexedDB sur l'appareil (05 §11.3) — la liste se
// lit côté client (`HistoriqueLocal`). Rien d'autre : ce que Relvo attend se
// lit en tête de l'échange vide et sur l'accueil (05 §11.12), pas ici ; et le
// « + » du header de l'échange ouvre un nouvel échange — pas de doublon.
//
// « Échange » et non « conversation » : depuis M6bis, une Conversation est une
// ENTITÉ DE DONNÉES — le fil avec un interlocuteur externe. Garder le même mot
// pour les deux ferait dire à l'utilisateur « ouvre la conversation avec Karim »
// et « reprends ma conversation d'hier » pour deux choses sans rapport.

export default async function RelvoHistoryPage() {
  await requireAccount();

  return (
    <MobileFrame>
      <main className="entre-ecran min-h-0 flex-1 overflow-y-auto bg-background">
        <RelvoHeader back="/relvo" title="Mes échanges avec Relvo" />
        <HistoriqueLocal />
      </main>
    </MobileFrame>
  );
}
