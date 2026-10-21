"use client";

import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import {
  activerPushAppareil,
  couperPushAppareil,
  type EtatPush,
  etatPushAppareil,
} from "@/lib/push-appareil";

// La ligne « Notifications » des Préférences (M12.7, M12.9). L'abonnement de
// CET appareil est le réglage : activer enregistre le service worker, demande
// l'autorisation sur ce geste — jamais au chargement —, s'abonne et confie
// l'abonnement au serveur, qui répond par une notification de bienvenue.
// Couper désabonne l'appareil. Quand le push n'est pas possible ici, la ligne
// le dit au lieu de montrer un interrupteur qui ne ferait rien. La mécanique
// vit dans `lib/push-appareil.ts`, partagée avec l'invitation de l'échange.

type Etat = { kind: "chargement" } | EtatPush;

export function NotificationsToggle({
  clePublique,
}: {
  /** La clé publique VAPID du déploiement, ou null quand le push n'est pas configuré. */
  clePublique: string | null;
}) {
  const [etat, setEtat] = useState<Etat>({ kind: "chargement" });
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    let vivant = true;
    etatPushAppareil(clePublique).then((e) => {
      if (vivant) setEtat(e);
    });
    return () => {
      vivant = false;
    };
  }, [clePublique]);

  function basculer(next: boolean) {
    if (etat.kind !== "pret" || !clePublique) return;
    const precedent = etat;
    setEtat({ kind: "pret", actif: next });
    startTransition(async () => {
      try {
        if (next) {
          const r = await activerPushAppareil(clePublique);
          if (!r.ok) {
            if (r.raison === "refuse") {
              setEtat({ kind: "refuse" });
              toast.error(
                "Les notifications sont bloquées pour Relvo dans les réglages du téléphone.",
              );
            } else {
              setEtat(precedent);
              if (r.raison === "erreur")
                toast.error("Le réglage n'a pas pu être enregistré.");
            }
            return;
          }
          toast.success("C'est activé. Une notification de bienvenue arrive.");
        } else {
          await couperPushAppareil();
          toast.success("Relvo ne vous préviendra plus sur cet appareil.");
        }
      } catch (err) {
        console.warn("[push] bascule", err);
        setEtat(precedent);
        toast.error("Le réglage n'a pas pu être enregistré.");
      }
    });
  }

  const explication = (() => {
    switch (etat.kind) {
      case "impossible":
        switch (etat.raison) {
          case "ios-non-installe":
            return "Sur iPhone, les notifications demandent l'application installée : dans Safari, Partager puis « Sur l'écran d'accueil », et ouvrez Relvo depuis l'icône.";
          case "sans-cle":
            return "Les notifications ne sont pas configurées sur ce déploiement.";
          default:
            return "Ce navigateur ne prend pas en charge les notifications.";
        }
      case "refuse":
        return "Les notifications sont bloquées pour Relvo dans les réglages du téléphone. Autorisez-les là, puis revenez ici.";
      default:
        return "Le brief du matin — réponses attendues, urgences, tâches du jour — et mes questions quand j'en ai. Rien d'autre : pas d'alerte à chaque message.";
    }
  })();

  const actif = etat.kind === "pret" && etat.actif;
  const inactif = etat.kind !== "pret";

  return (
    <div className="overflow-hidden rounded-(--rayon-carte) border border-(--filet) bg-white shadow-carte">
      <label className="flex cursor-pointer items-center gap-3 px-4 py-3.5">
        <div className="min-w-0 flex-1">
          <div className="text-[14.5px] font-normal text-noir">
            Notifications sur cet appareil
          </div>
          <div className="mt-0.5 text-[14px] leading-5 font-light text-gris">
            {explication}
          </div>
        </div>
        <Switch
          size="lg"
          checked={actif}
          disabled={inactif || pending}
          onCheckedChange={basculer}
          aria-label="Notifications sur cet appareil"
        />
      </label>
    </div>
  );
}
