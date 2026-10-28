import { appBaseUrl } from "@/server/unipile/client";
import { type RetourConnexion, pageDeRetour } from "@/server/courrier/retour";

// Les adresses de retour de la page de connexion de l'AGRÉGATEUR : où revient
// l'utilisateur quand il a fini (ou renoncé), et où l'agrégateur nous
// prévient. La page de retour elle-même est celle de la frontière
// (`server/courrier/retour.ts`), la même que pour le relais Gmail.

export type { RetourConnexion };

export function urlsDeConnexion(retour: RetourConnexion = "canaux") {
  const base = appBaseUrl();
  // Le callback notify_url ne porte pas le header custom d'Unipile → on le
  // sécurise par un token en query-string (même secret que les webhooks managés).
  const secret = process.env.UNIPILE_WEBHOOK_SECRET ?? "";
  return {
    notifyUrl: `${base}/api/webhooks/unipile?secret=${encodeURIComponent(secret)}`,
    successRedirectUrl: `${base}${pageDeRetour(retour, { connected: true })}`,
    failureRedirectUrl: `${base}${pageDeRetour(retour, { erreur: "fournisseur" })}`,
  };
}
