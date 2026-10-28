import { DomainError } from "@relvo/db/erreurs";

// L'API GMAIL, en `fetch` (M24.3) : ce dont le relais a besoin, rien de plus —
// le profil, l'abonnement aux changements, l'historique, un message entier,
// une pièce jointe. Un jeton d'accès en entrée (`acces.ts` le tient valide) ;
// un 404 se rend en `null` là où il a un sens (un message effacé, un
// historique trop ancien), tout autre échec est une erreur dite.

const BASE = "https://gmail.googleapis.com/gmail/v1/users/me";

export type EnTete = { name: string; value: string };
export type PartieGmail = {
  partId?: string;
  mimeType?: string;
  filename?: string;
  headers?: EnTete[];
  body?: { attachmentId?: string; size?: number; data?: string };
  parts?: PartieGmail[];
};
export type MessageGmail = {
  id: string;
  threadId?: string;
  labelIds?: string[];
  /** Millisecondes depuis l'époque, en chaîne. */
  internalDate?: string;
  payload?: PartieGmail;
};
type Historique = {
  history?: {
    id?: string;
    messagesAdded?: { message?: { id?: string; labelIds?: string[] } }[];
  }[];
  nextPageToken?: string;
  historyId?: string;
};

async function appel<T>(
  acces: string,
  chemin: string,
  init: {
    method?: string;
    body?: unknown;
    params?: Record<string, string>;
  } = {},
): Promise<{ status: number; json: T | null }> {
  const url = new URL(`${BASE}/${chemin}`);
  for (const [k, v] of Object.entries(init.params ?? {})) {
    url.searchParams.set(k, v);
  }
  const res = await fetch(url, {
    method: init.method ?? "GET",
    headers: {
      authorization: `Bearer ${acces}`,
      ...(init.body ? { "content-type": "application/json" } : {}),
    },
    body: init.body ? JSON.stringify(init.body) : undefined,
  });
  const json = (await res.json().catch(() => null)) as T | null;
  if (!res.ok && res.status !== 404) {
    const erreur = (json as { error?: { message?: string } } | null)?.error;
    console.error("[gmail] API en échec", {
      chemin,
      status: res.status,
      message: erreur?.message,
    });
    throw new DomainError(
      "INVALID_STATE",
      res.status === 401 || res.status === 403
        ? "Google refuse l'accès à cette boîte : reconnectez-la."
        : "Google n'a pas répondu. Réessayez dans un instant.",
      { details: { google: res.status } },
    );
  }
  return { status: res.status, json };
}

export async function profil(
  acces: string,
): Promise<{ emailAddress: string; historyId: string }> {
  const { json } = await appel<{ emailAddress?: string; historyId?: string }>(
    acces,
    "profile",
  );
  if (!json?.emailAddress || !json.historyId) {
    throw new DomainError(
      "INVALID_STATE",
      "Google n'a pas dit le profil de la boîte.",
    );
  }
  return { emailAddress: json.emailAddress, historyId: json.historyId };
}

/** `users.watch` : la boîte publie ses changements sur notre sujet Pub/Sub, pour sept jours au plus. */
export async function abonner(
  acces: string,
  topicName: string,
): Promise<{ historyId: string; expireA: Date }> {
  const { json } = await appel<{ historyId?: string; expiration?: string }>(
    acces,
    "watch",
    { method: "POST", body: { topicName } },
  );
  if (!json?.historyId || !json.expiration) {
    throw new DomainError(
      "INVALID_STATE",
      "Google n'a pas confirmé l'abonnement de la boîte.",
    );
  }
  return {
    historyId: json.historyId,
    expireA: new Date(Number(json.expiration)),
  };
}

/**
 * Les messages AJOUTÉS depuis un numéro d'historique, page par page. `null`
 * quand le numéro est trop ancien (Google n'en garde qu'une semaine) : la
 * boîte a un trou, à combler par une lecture, pas par l'historique.
 */
export async function historiqueDepuis(
  acces: string,
  args: { startHistoryId: string; pageToken?: string },
): Promise<{
  ajoutes: { id: string; labelIds: string[] }[];
  nextPageToken: string | null;
  historyId: string | null;
} | null> {
  const { status, json } = await appel<Historique>(acces, "history", {
    params: {
      startHistoryId: args.startHistoryId,
      historyTypes: "messageAdded",
      ...(args.pageToken ? { pageToken: args.pageToken } : {}),
    },
  });
  if (status === 404) return null;
  const ajoutes: { id: string; labelIds: string[] }[] = [];
  for (const h of json?.history ?? []) {
    for (const a of h.messagesAdded ?? []) {
      if (a.message?.id) {
        ajoutes.push({ id: a.message.id, labelIds: a.message.labelIds ?? [] });
      }
    }
  }
  return {
    ajoutes,
    nextPageToken: json?.nextPageToken ?? null,
    historyId: json?.historyId ?? null,
  };
}

/** Un message entier (en-têtes, corps, pièces). `null` s'il n'existe plus — un brouillon jeté. */
export async function lireMessage(
  acces: string,
  id: string,
): Promise<MessageGmail | null> {
  const { status, json } = await appel<MessageGmail>(acces, `messages/${id}`, {
    params: { format: "full" },
  });
  if (status === 404 || !json?.id) return null;
  return json;
}

export async function lirePieceJointe(
  acces: string,
  messageId: string,
  attachmentId: string,
): Promise<Uint8Array | null> {
  const { status, json } = await appel<{ data?: string }>(
    acces,
    `messages/${messageId}/attachments/${encodeURIComponent(attachmentId)}`,
  );
  if (status === 404 || !json?.data) return null;
  return new Uint8Array(Buffer.from(json.data, "base64url"));
}
