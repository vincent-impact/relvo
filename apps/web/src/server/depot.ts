import "server-only";
import { createHash } from "node:crypto";
import {
  type TenantDb,
  poidsStockeDuCompte,
  trouverCleDeMemeContenu,
} from "@relvo/db";
import { buildObjectKey, getStorage } from "@relvo/storage";
import { MEDIAS, partDuQuota } from "@/lib/medias";

// LE DÉPÔT D'UNE PIÈCE DANS LE STOCKAGE — le seul chemin par lequel un fichier
// reçu (e-mail ou messagerie) entre dans le bucket. Deux règles y vivent :
//
//   · LA DÉDUPLICATION (M25.8) : avant de poser un fichier, on demande au
//     domaine si le compte l'a déjà — même empreinte, même poids. Si oui, la
//     pièce PARTAGE sa clé et rien n'est écrit. L'empreinte est le MD5 du
//     contenu : celle que le stockage calcule lui-même pour chaque objet.
//   · LE QUOTA (M25.7) : ce qu'un compte fait peser, contre une garde lue
//     d'une configuration. Au quota, plus rien ne se stocke DE LUI-MÊME — les
//     pièces de messagerie entrent en référence ; ce que le dirigeant ouvre
//     se stocke encore, et l'e-mail garde ses pièces.

export type Depot = {
  key: string;
  octets: number;
  /** L'empreinte du contenu, à noter sur la pièce. */
  empreinte: string;
  /** Le fichier existait déjà : la clé est celle d'une AUTRE pièce — ne jamais l'effacer. */
  partagee: boolean;
};

/**
 * Pose un fichier pour un compte, ou rend la clé du même fichier s'il y est
 * déjà. ⚠️ Entre la recherche et la création de la pièce, la pièce dont on
 * emprunte la clé peut partir : la file de suppression ne détruit qu'une clé
 * que PERSONNE ne tient au moment du drainage — créer la pièce aussitôt après
 * cet appel est ce qui la protège.
 */
export async function deposerUnePiece(
  db: TenantDb,
  accountId: string,
  bytes: Uint8Array,
  contentType: string | null,
): Promise<Depot> {
  const empreinte = createHash("md5").update(bytes).digest("hex");
  const octets = bytes.byteLength;
  const deja = await trouverCleDeMemeContenu(db, {
    contentHash: empreinte,
    fileSize: octets,
  });
  if (deja) return { key: deja, octets, empreinte, partagee: true };
  const key = buildObjectKey({ accountId, scope: "attachments" });
  await getStorage().put({
    key,
    body: bytes,
    contentType: contentType ?? "application/octet-stream",
  });
  return { key, octets, empreinte, partagee: false };
}

/** Le quota d'un compte, en octets : une configuration (`STOCKAGE_QUOTA_COMPTE_GO`). */
export function quotaDuCompte(): number {
  const go =
    Number(process.env.STOCKAGE_QUOTA_COMPTE_GO) || MEDIAS.quotaParCompteGo;
  return go * 1024 ** 3;
}

export type EspaceDuCompte = {
  octets: number;
  quotaOctets: number;
  /** De 0 à 1, plafonnée : la part du quota consommée. */
  part: number;
  /** Au quota : plus rien ne se stocke de lui-même. */
  plein: boolean;
};

/** Ce qu'un compte consomme de son quota — la même lecture pour la garde, l'Usage et le backoffice. */
export async function espaceDuCompte(
  accountId: string,
): Promise<EspaceDuCompte> {
  const octets = await poidsStockeDuCompte(accountId);
  const quotaOctets = quotaDuCompte();
  const part = partDuQuota(octets, quotaOctets);
  return { octets, quotaOctets, part, plein: part >= 1 };
}
