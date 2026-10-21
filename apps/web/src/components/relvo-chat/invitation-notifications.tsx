"use client";

import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { EtapeFormulaire } from "@/components/relvo-chat/etape-formulaire";
import { RelvoBlock, RelvoSentence } from "@/components/shared/relvo-block";
import { doitReproposer } from "@/lib/push-client";
import {
  activerPushAppareil,
  type EtatPush,
  etatPushAppareil,
  lirePlusTard,
  poserPlusTard,
} from "@/lib/push-appareil";

// L'INVITATION À ACTIVER LES NOTIFICATIONS, dans l'échange (05 §11.11) : la
// dernière étape de la prise en main, et la seule qui ne soit pas une question
// du compte — l'abonnement est celui de CET appareil, et la permission ne
// s'obtient que sur un geste. Elle se pose quand les questions de Relvo sont
// traitées, tant que l'appareil n'est pas abonné ; « Plus tard » la retient
// sur l'appareil et la repose après quelques jours. Sur un iPhone hors
// application installée, elle dit le geste à faire au lieu d'un bouton qui ne
// ferait rien. Même forme que les questions : un formulaire de Relvo.

const ACTIVER = "activer";
const PLUS_TARD = "plus-tard";
const COMPRIS = "compris";

export function InvitationNotifications({
  clePublique,
}: {
  clePublique: string | null;
}) {
  const [etat, setEtat] = useState<EtatPush | null>(null);
  const [cachee, setCachee] = useState(true);
  const [fait, setFait] = useState(false);
  const [pending, start] = useTransition();

  useEffect(() => {
    let vivant = true;
    if (!doitReproposer(lirePlusTard())) return;
    etatPushAppareil(clePublique).then((e) => {
      if (!vivant) return;
      setEtat(e);
      setCachee(false);
    });
    return () => {
      vivant = false;
    };
  }, [clePublique]);

  if (cachee || !etat) return null;
  if (etat.kind === "refuse") return null;
  if (etat.kind === "impossible" && etat.raison !== "ios-non-installe")
    return null;
  if (etat.kind === "pret" && etat.actif) return null;

  if (fait) {
    return (
      <RelvoBlock className="mb-3 pb-2.5" label="Relvo a noté votre réponse">
        <RelvoSentence>
          ✦ C’est activé : vous aurez le brief du matin et mes questions sur cet
          appareil. Rien d’autre.
        </RelvoSentence>
      </RelvoBlock>
    );
  }

  function choisir(key: string) {
    if (key === PLUS_TARD || key === COMPRIS) {
      poserPlusTard();
      setCachee(true);
      return;
    }
    if (!clePublique) return;
    start(async () => {
      const r = await activerPushAppareil(clePublique);
      if (r.ok) {
        setFait(true);
        return;
      }
      if (r.raison === "refuse") {
        toast.error(
          "Les notifications sont bloquées pour Relvo dans les réglages du téléphone.",
        );
        setCachee(true);
      } else if (r.raison === "erreur") {
        toast.error("Je n’ai pas pu activer les notifications. Réessayez.");
      }
    });
  }

  const iosNonInstalle = etat.kind === "impossible";
  return (
    <RelvoBlock className="mb-3 pb-3" label="Une question de Relvo">
      <EtapeFormulaire
        question={
          iosNonInstalle
            ? "Pour que je puisse vous prévenir — le brief du matin, mes questions —, installez Relvo sur votre écran d’accueil : dans Safari, Partager puis « Sur l’écran d’accueil », et ouvrez-moi depuis l’icône."
            : "Je peux vous prévenir sur cet appareil : le brief du matin, et mes questions quand j’en ai. Rien d’autre — pas d’alerte à chaque message. On l’active ?"
        }
        options={
          iosNonInstalle
            ? [{ key: COMPRIS, label: "Compris, je le ferai", secondary: true }]
            : [
                {
                  key: ACTIVER,
                  label: "Activer les notifications",
                  hint: "Le téléphone vous demandera votre accord",
                },
                { key: PLUS_TARD, label: "Plus tard", secondary: true },
              ]
        }
        onChoose={choisir}
        busyKey={pending ? ACTIVER : null}
      />
    </RelvoBlock>
  );
}
