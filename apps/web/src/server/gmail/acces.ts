import { setChannelConfigStatus } from "@relvo/db";
import { DomainError, isDomainError } from "@relvo/db/erreurs";
import { tenantDb } from "@/lib/tenant-db";
import { chiffrer } from "./chiffrement";
import { donneesDeLaBoite, ecrireDonnees, type BoiteGmail } from "./donnees";
import { jetonsDepuisDonnees } from "./jetons";
import { rafraichirLAcces } from "./oauth";

// LE JETON D'ACCÈS d'une boîte, valide (M24.3) : relu de ses données, rafraîchi
// s'il expire dans la minute, le nouveau réécrit chiffré. Quand Google ne
// reconnaît plus l'accès (`invalid_grant` : révoqué, mot de passe changé), le
// canal passe « en erreur » par le domaine — la page Canaux montrera
// « Reconnecter » — et l'erreur remonte.

const MARGE_MS = 60 * 1000;

export async function jetonDAcces(
  externalAccountId: string,
  boite?: BoiteGmail | null,
): Promise<string> {
  const b = boite ?? (await donneesDeLaBoite(externalAccountId));
  if (!b) {
    throw new DomainError(
      "NOT_FOUND",
      "Cette boîte Gmail n'est pas reliée à Relvo.",
    );
  }
  const jetons = jetonsDepuisDonnees(b.connectionData);
  if (!jetons) {
    throw new DomainError(
      "INVALID_STATE",
      "Cette boîte n'a pas d'accès Google enregistré : reconnectez-la.",
    );
  }
  if (jetons.expireA.getTime() - Date.now() > MARGE_MS) return jetons.acces;
  try {
    const neuf = await rafraichirLAcces(jetons.rafraichissement);
    await ecrireDonnees(b.channelId, {
      jetons: {
        rafraichissement: b.donnees.jetons!.rafraichissement,
        acces: chiffrer(neuf.acces),
        expireA: neuf.expireA.toISOString(),
      },
    });
    return neuf.acces;
  } catch (err) {
    const google = (err as { details?: { google?: unknown } }).details?.google;
    if (isDomainError(err) && google === "invalid_grant") {
      try {
        await setChannelConfigStatus(
          tenantDb(b.accountId),
          b.channelId,
          "error",
        );
      } catch (e) {
        console.error(
          "[gmail] statut non posé en erreur",
          { channelId: b.channelId },
          e,
        );
      }
    }
    throw err;
  }
}
