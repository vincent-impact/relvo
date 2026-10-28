import type {
  Boite,
  CourrierEntrant,
  NatureDuCourrier,
  PieceJointeRef,
} from "@/server/courrier/types";
import {
  adresseEtNom,
  adressesDe,
  htmlFidele,
  texteLisible,
} from "@/server/courrier/corps";
import type { MessageGmail, PartieGmail } from "./api";

// GMAIL → la forme PIVOT de la frontière (M24.3). Un message de l'API devient
// un `CourrierEntrant` : sa nature d'après ses ÉTIQUETTES (#69 — `DRAFT`,
// `SPAM`, `TRASH`, `SENT`, `INBOX`, comme les dossiers de l'agrégateur),
// l'entrée du domaine qui va avec, ses pièces jointes. Mapper PUR, testable
// sans réseau.

/**
 * La requête de la LECTURE à la connexion (M24.4) : la boîte de réception
 * depuis une date — comme la liste de l'agrégateur, bornée à `inbox` : les
 * envoyés, les brouillons, la corbeille et l'indésirable ne sont pas du
 * courrier à trier. `after:` en secondes depuis l'époque, ce que Gmail lit.
 */
export function requeteDeLecture(after: Date): string {
  return `in:inbox -in:spam -in:trash after:${Math.floor(after.getTime() / 1000)}`;
}

export function natureDepuisEtiquettes(
  labelIds: readonly string[],
  expediteur: string | null,
  nosAdresses: readonly (string | null | undefined)[],
): NatureDuCourrier {
  const etiquettes = new Set(labelIds.map((l) => l.toUpperCase()));
  if (etiquettes.has("DRAFT")) return "brouillon";
  if (etiquettes.has("SPAM") || etiquettes.has("TRASH")) return "ecarte";
  if (etiquettes.has("SENT")) return "envoye";
  const nous = new Set(
    nosAdresses
      .filter((a): a is string => Boolean(a))
      .map((a) => a.trim().toLowerCase()),
  );
  if (expediteur && nous.has(expediteur) && !etiquettes.has("INBOX")) {
    return "envoye";
  }
  return "recu";
}

export function entetesDe(message: MessageGmail): Record<string, string> {
  const out: Record<string, string> = {};
  for (const h of message.payload?.headers ?? []) {
    if (h.name && h.value) out[h.name.toLowerCase()] = h.value;
  }
  return out;
}

type Corps = {
  plain: string | null;
  html: string | null;
  pieces: PieceJointeRef[];
};

function decoder(data: string | undefined): string | null {
  if (!data) return null;
  return Buffer.from(data, "base64url").toString("utf8");
}

/** Parcourt l'arbre MIME : le premier texte, le premier HTML, les pièces nommées. */
export function corpsDe(partie: PartieGmail | undefined): Corps {
  const corps: Corps = { plain: null, html: null, pieces: [] };
  const visiter = (p: PartieGmail | undefined) => {
    if (!p) return;
    const mime = (p.mimeType ?? "").toLowerCase();
    if (p.filename && p.body?.attachmentId) {
      corps.pieces.push({
        id: p.body.attachmentId,
        name: p.filename,
        mime: p.mimeType ?? null,
        size: p.body.size ?? null,
      });
      return;
    }
    if (mime === "text/plain" && corps.plain == null) {
      corps.plain = decoder(p.body?.data);
    } else if (mime === "text/html" && corps.html == null) {
      corps.html = decoder(p.body?.data);
    }
    for (const sous of p.parts ?? []) visiter(sous);
  };
  visiter(partie);
  return corps;
}

function dateDe(
  message: MessageGmail,
  entetes: Record<string, string>,
): string | null {
  const ms = Number(message.internalDate);
  if (message.internalDate && Number.isFinite(ms) && ms > 0) {
    return new Date(ms).toISOString();
  }
  const d = entetes.date ? new Date(entetes.date) : null;
  return d && !Number.isNaN(d.getTime()) ? d.toISOString() : null;
}

export function courrierDepuisGmail(
  message: MessageGmail,
  boite: Pick<Boite, "channelId" | "nosAdresses">,
): CourrierEntrant {
  const entetes = entetesDe(message);
  const expediteur = adresseEtNom(entetes.from);
  const labelIds = message.labelIds ?? [];
  const nature = natureDepuisEtiquettes(
    labelIds,
    expediteur.adresse,
    boite.nosAdresses,
  );
  const date = dateDe(message, entetes);
  if (nature === "brouillon" || nature === "ecarte") {
    return {
      nature,
      externalId: message.id,
      date,
      motif: labelIds.find((l) => /^(DRAFT|SPAM|TRASH)$/i.test(l)) ?? null,
    };
  }
  const corps = corpsDe(message.payload);
  const recipients = [...adressesDe(entetes.to), ...adressesDe(entetes.cc)];
  const commun = {
    channelId: boite.channelId,
    externalId: message.id,
    externalThreadId: message.threadId ?? null,
    recipients,
    subjectLine: entetes.subject ?? null,
    content: texteLisible({ plain: corps.plain, html: corps.html }),
    contentHtml: htmlFidele(corps.html),
  };
  const instant = date ? new Date(date) : null;
  if (nature === "envoye") {
    return {
      nature,
      externalId: message.id,
      date,
      sortant: {
        ...commun,
        trackingId: null,
        // Un envoi que l'historique apporte est parti d'un client — ou c'est
        // l'écho d'un envoi de Relvo, déjà en base sous le même identifiant.
        origin: "external",
        sentAt: instant,
      },
      pieces: corps.pieces,
    };
  }
  return {
    nature,
    externalId: message.id,
    date,
    entrant: {
      ...commun,
      senderRaw: expediteur.adresse,
      senderName: expediteur.nom,
      receivedAt: instant,
    },
    pieces: corps.pieces,
    entetes,
  };
}
