import { poserEtat } from "./etat";
import { urlDeConsentement } from "./oauth";
import type { RetourConnexion } from "@/server/courrier/retour";

// Le DÉPART vers le consentement Google (M24.2) : depuis une Server Action —
// la page des canaux, l'échange de la prise en main, « Reconnecter » — on pose
// l'état dans le cookie et on rend l'URL de Google ; le navigateur y va, et
// revient par `/api/gmail/retour`. Le canal est déjà préparé ou existant :
// c'est le retour qui le finalise (`completeChannelConnection`).

export async function demarrerConnexionGmail(input: {
  channelId: string;
  retour: RetourConnexion;
  /** La boîte qu'on reconnecte : présélectionnée chez Google, et exigée au retour. */
  adresse?: string | null;
}): Promise<string> {
  const nonce = await poserEtat({
    channelId: input.channelId,
    retour: input.retour,
    ...(input.adresse ? { adresse: input.adresse } : {}),
  });
  return urlDeConsentement({ state: nonce, loginHint: input.adresse });
}
