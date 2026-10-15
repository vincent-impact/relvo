import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import type { RelvoUIMessage } from "@/server/ia/echange/outils";
import {
  HISTORIQUE_MAX,
  purger,
  type EchangeLocal,
} from "@/lib/echanges-regles";

// La MÉMOIRE LOCALE des échanges (M10.2, 05 §11.3) : IndexedDB, sur
// l'appareil, éphémère. Aucune entité serveur — ce qui persiste, ce sont les
// gestes et leurs résultats, dans la base ; le dialogue qui les a demandés n'a
// pas de valeur au-delà de la session. Pas de cross-device, et c'est assumé.
//
// Les messages sont ceux de l'interface, rejoués tels quels au tour suivant —
// outils et résultats compris. Chaque sauvegarde purge au-delà de
// `HISTORIQUE_MAX` ; « Effacer mon historique » vide tout.

export type EchangeStocke = EchangeLocal<RelvoUIMessage>;

interface Schema extends DBSchema {
  echanges: {
    key: string;
    value: EchangeStocke;
    indexes: { "par-dernier-tour": string };
  };
}

const NOM = "relvo-echanges";
const VERSION = 1;

let ouverture: Promise<IDBPDatabase<Schema>> | null = null;

/** Null hors navigateur, ou quand IndexedDB est indisponible (navigation privée stricte). */
function base(): Promise<IDBPDatabase<Schema>> | null {
  if (typeof indexedDB === "undefined") return null;
  ouverture ??= openDB<Schema>(NOM, VERSION, {
    upgrade(db) {
      const store = db.createObjectStore("echanges", { keyPath: "id" });
      store.createIndex("par-dernier-tour", "dernierTourLe");
    },
  }).catch((err) => {
    ouverture = null;
    throw err;
  });
  return ouverture;
}

async function avec<T>(
  fn: (db: IDBPDatabase<Schema>) => Promise<T>,
  repli: T,
): Promise<T> {
  const p = base();
  if (!p) return repli;
  try {
    return await fn(await p);
  } catch (err) {
    console.warn("[relvo] mémoire locale indisponible", err);
    return repli;
  }
}

export function lireEchange(id: string): Promise<EchangeStocke | null> {
  return avec(async (db) => (await db.get("echanges", id)) ?? null, null);
}

/** Les échanges, du plus récent au plus ancien. */
export function listerEchanges(): Promise<EchangeStocke[]> {
  return avec(async (db) => {
    const tous = await db.getAllFromIndex("echanges", "par-dernier-tour");
    return tous.reverse();
  }, []);
}

export async function dernierEchange(): Promise<EchangeStocke | null> {
  const [premier] = await listerEchanges();
  return premier ?? null;
}

/** Sauve (ou remplace) un échange, et purge au-delà du plafond. */
export function sauverEchange(e: EchangeStocke): Promise<void> {
  return avec(async (db) => {
    await db.put("echanges", e);
    const tous = await db.getAll("echanges");
    const { supprimes } = purger(tous, HISTORIQUE_MAX);
    if (supprimes.length) {
      const tx = db.transaction("echanges", "readwrite");
      await Promise.all([
        ...supprimes.map((s) => tx.store.delete(s.id)),
        tx.done,
      ]);
    }
  }, undefined);
}

export function supprimerEchange(id: string): Promise<void> {
  return avec(async (db) => db.delete("echanges", id), undefined);
}

export function viderEchanges(): Promise<void> {
  return avec(async (db) => db.clear("echanges"), undefined);
}
