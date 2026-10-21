import { appBaseUrl } from "@/server/unipile/client";

// Les adresses de retour de la page de connexion du fournisseur : où revient
// l'utilisateur quand il a fini (ou renoncé), et où le fournisseur nous
// prévient. Deux provenances : la page des canaux, et l'échange avec Relvo —
// la prise en main y demande la boîte en dernier (05 §11.11), et c'est là que
// la lecture se suit ensuite. `connected=1` dit à la page de revenir que la
// connexion vient d'être faite : elle se rafraîchit jusqu'à voir la lecture.

export type RetourConnexion = "canaux" | "relvo";

const RETOURS: Record<RetourConnexion, string> = {
  canaux: "/canaux",
  relvo: "/relvo?from=%2F",
};

export function urlsDeConnexion(retour: RetourConnexion = "canaux") {
  const base = appBaseUrl();
  // Le callback notify_url ne porte pas le header custom d'Unipile → on le
  // sécurise par un token en query-string (même secret que les webhooks managés).
  const secret = process.env.UNIPILE_WEBHOOK_SECRET ?? "";
  const page = `${base}${RETOURS[retour]}`;
  const sep = page.includes("?") ? "&" : "?";
  return {
    notifyUrl: `${base}/api/webhooks/unipile?secret=${encodeURIComponent(secret)}`,
    successRedirectUrl: `${page}${sep}connected=1`,
    failureRedirectUrl: `${page}${sep}error=1`,
  };
}
