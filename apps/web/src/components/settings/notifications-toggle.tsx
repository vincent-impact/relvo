"use client";

import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import {
  cleEnOctets,
  disponibilitePush,
  type DisponibilitePush,
} from "@/lib/push-client";
import { abonnerPushAction, desabonnerPushAction } from "@/server/actions/push";

// La ligne « Notifications » des Préférences (M12.7, M12.9). L'abonnement de
// CET appareil est le réglage : activer enregistre le service worker, demande
// l'autorisation sur ce geste — jamais au chargement —, s'abonne et confie
// l'abonnement au serveur, qui répond par une notification de bienvenue.
// Couper désabonne l'appareil. Quand le push n'est pas possible ici, la ligne
// le dit au lieu de montrer un interrupteur qui ne ferait rien.

type Etat =
  | { kind: "chargement" }
  | {
      kind: "impossible";
      raison: Exclude<DisponibilitePush, "disponible"> | "sans-cle";
    }
  | { kind: "refuse" }
  | { kind: "pret"; actif: boolean };

const SW_URL = "/sw.js";

async function abonnementCourant(): Promise<PushSubscription | null> {
  const registration = await navigator.serviceWorker.getRegistration(SW_URL);
  if (!registration) return null;
  return registration.pushManager.getSubscription();
}

function enEntree(sub: PushSubscription) {
  const json = sub.toJSON();
  return {
    endpoint: sub.endpoint,
    keys: { p256dh: json.keys?.p256dh ?? "", auth: json.keys?.auth ?? "" },
    userAgent: navigator.userAgent.slice(0, 400),
  };
}

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
    (async () => {
      if (!clePublique) {
        setEtat({ kind: "impossible", raison: "sans-cle" });
        return;
      }
      const dispo = disponibilitePush({
        serviceWorker: "serviceWorker" in navigator,
        pushManager: "PushManager" in window,
        notification: "Notification" in window,
        userAgent: navigator.userAgent,
      });
      if (dispo !== "disponible") {
        setEtat({ kind: "impossible", raison: dispo });
        return;
      }
      if (Notification.permission === "denied") {
        setEtat({ kind: "refuse" });
        return;
      }
      try {
        const sub = await abonnementCourant();
        if (!vivant) return;
        if (sub) {
          // L'appareil est déjà abonné : on le redit au serveur, sans bruit —
          // des clés rafraîchies, un compte qui a changé sur cet appareil.
          void abonnerPushAction(enEntree(sub));
        }
        setEtat({ kind: "pret", actif: Boolean(sub) });
      } catch {
        if (vivant) setEtat({ kind: "pret", actif: false });
      }
    })();
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
          const permission = await Notification.requestPermission();
          if (permission !== "granted") {
            setEtat(permission === "denied" ? { kind: "refuse" } : precedent);
            if (permission === "denied")
              toast.error(
                "Les notifications sont bloquées pour Relvo dans les réglages du téléphone.",
              );
            return;
          }
          const registration = await navigator.serviceWorker.register(SW_URL);
          await navigator.serviceWorker.ready;
          const sub =
            (await registration.pushManager.getSubscription()) ??
            (await registration.pushManager.subscribe({
              userVisibleOnly: true,
              applicationServerKey: cleEnOctets(clePublique) as BufferSource,
            }));
          const result = await abonnerPushAction(enEntree(sub));
          if (!result.ok) throw new Error(result.message);
          toast.success("C'est activé. Une notification de bienvenue arrive.");
        } else {
          const sub = await abonnementCourant();
          if (sub) {
            const endpoint = sub.endpoint;
            await sub.unsubscribe();
            const result = await desabonnerPushAction(endpoint);
            if (!result.ok) throw new Error(result.message);
          }
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
