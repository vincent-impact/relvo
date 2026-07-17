import "server-only";
import { UnipileClient } from "unipile-node-sdk";

// Client Unipile (M5) — s'appuie sur le SDK OFFICIEL `unipile-node-sdk` (v1).
// Les signatures viennent des types du package (source de vérité), pas d'une
// doc résumée. Namespaces utilisés : `account.*`, `email.*`, `webhook.*`.
//
// Lazy à dessein : on n'instancie qu'au premier appel, jamais à l'import
// (sinon `next build`, sans les vars runtime, casserait — même règle que
// `getStorage()`). Sans configuration, on dégrade proprement en journalisant
// (comme `lib/email.ts` sans clé Resend) pour développer les flux hors ligne.

type UnipileConfig = { dsn: string; apiKey: string };

let cachedConfig: UnipileConfig | null | undefined;
let cachedClient: UnipileClient | null | undefined;

function loadConfig(): UnipileConfig | null {
  if (cachedConfig !== undefined) return cachedConfig;
  const rawDsn = process.env.UNIPILE_DSN;
  const apiKey = process.env.UNIPILE_API_KEY;
  if (!rawDsn || !apiKey) {
    cachedConfig = null;
    return cachedConfig;
  }
  // Le dashboard Unipile affiche le DSN sans schéma (`apiXX.unipile.com:PORT`),
  // mais le SDK exige une URL complète → on préfixe `https://` si absent.
  const withScheme = /^https?:\/\//i.test(rawDsn)
    ? rawDsn
    : `https://${rawDsn}`;
  cachedConfig = { dsn: withScheme.replace(/\/+$/, ""), apiKey };
  return cachedConfig;
}

function getClient(): { client: UnipileClient; dsn: string } | null {
  const cfg = loadConfig();
  if (!cfg) return null;
  cachedClient ??= new UnipileClient(cfg.dsn, cfg.apiKey);
  return { client: cachedClient, dsn: cfg.dsn };
}

/** URL publique de l'app — cible des `notify_url` / redirections hosted auth.
 *
 * `UNIPILE_PUBLIC_URL` prime : en dev, Unipile ne peut pas joindre `localhost`,
 * on y met alors l'URL d'un tunnel (cloudflared/ngrok). En prod, cette variable
 * est absente et on retombe sur AUTH_URL / VERCEL_URL. */
export function appBaseUrl(): string {
  return (
    process.env.UNIPILE_PUBLIC_URL ??
    process.env.AUTH_URL ??
    process.env.NEXT_PUBLIC_APP_URL ??
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null) ??
    "http://localhost:3000"
  );
}

/**
 * Crée un lien de « hosted auth » email : Unipile héberge tout le flux
 * OAuth/IMAP, on redirige l'utilisateur vers l'URL renvoyée. `name` porte NOTRE
 * identifiant (le channelId pré-créé), qui nous revient dans le webhook
 * `notify_url` pour relier le compte Unipile au bon Channel.
 *
 * `sync_limit.MAILING = "NO_HISTORY_SYNC"` : on ne veut QUE le nouveau courrier
 * (arbitrage produit) — ce qui évite au passage les scopes Gmail « restricted »
 * et l'audit CASA. `providers: "*:MAILING"` propose tous les fournisseurs mail
 * (Gmail/Outlook/IMAP : OVH, Orange, Free…).
 *
 * Retourne `null` si Unipile n'est pas configuré (dev).
 */
/** Fournisseurs mail proposés par Unipile (`MAIL` = IMAP/SMTP générique). */
export type MailProvider = "GOOGLE" | "OUTLOOK" | "MAIL";

export async function createEmailHostedAuthLink(input: {
  channelId: string;
  notifyUrl: string;
  successRedirectUrl: string;
  failureRedirectUrl: string;
  expiresInMinutes?: number;
  /** Provider unique choisi côté app → saute l'écran de sélection Unipile.
   *  Omis → on propose les trois (Gmail/Outlook/IMAP). */
  provider?: MailProvider;
}): Promise<string | null> {
  const ctx = getClient();
  if (!ctx) {
    console.warn(
      "[unipile] UNIPILE_DSN/UNIPILE_API_KEY absents — hosted auth indisponible (dev).",
    );
    return null;
  }
  const expiresOn = new Date(
    Date.now() + (input.expiresInMinutes ?? 60) * 60_000,
  ).toISOString();

  const hostedAuthInput = {
    type: "create",
    // Fournisseurs mail : Gmail/Outlook en OAuth un-clic, `MAIL` = IMAP/SMTP
    // générique pour le reste (OVH, Orange, Free…). Si l'app a déjà fait choisir
    // le type, on ne propose que celui-là → Unipile saute son écran de sélection.
    providers: input.provider
      ? [input.provider]
      : ["GOOGLE", "OUTLOOK", "MAIL"],
    api_url: ctx.dsn,
    expiresOn,
    name: input.channelId,
    notify_url: input.notifyUrl,
    success_redirect_url: input.successRedirectUrl,
    failure_redirect_url: input.failureRedirectUrl,
    // `sync_limit.MAILING = NO_HISTORY_SYNC` : ne PAS importer l'historique à la
    // connexion (arbitrage « nouveau courrier seulement »). Le champ existe dans
    // le schéma wire d'Unipile mais le type TS exporté par le SDK est en retard
    // dessus — d'où le cast ciblé (le SDK valide en interne contre le schéma
    // complet, qui l'accepte).
    sync_limit: { MAILING: "NO_HISTORY_SYNC" },
  };
  type HostedAuthArg = Parameters<
    typeof ctx.client.account.createHostedAuthLink
  >[0];
  const res = await ctx.client.account.createHostedAuthLink(
    hostedAuthInput as unknown as HostedAuthArg,
  );
  return res.url;
}

/**
 * Convertit notre corps TEXTE (saisi au composer, avec de vrais `\n`, espaces et
 * tabulations) en HTML qui préserve la mise en forme. Le champ `body` d'Unipile
 * est interprété comme du HTML (le webhook entrant sépare d'ailleurs `body` HTML
 * de `body_plain` texte) : envoyer du texte brut y écrase les retours à la ligne
 * → l'email arrive « aplati ». On échappe le HTML puis on rétablit sauts de
 * ligne (`<br>`), tabulations et indentations (`&nbsp;`).
 */
function textToHtmlBody(text: string): string {
  const escaped = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  const inner = escaped
    .replace(/\r\n?/g, "\n")
    .replace(/\t/g, "&nbsp;&nbsp;&nbsp;&nbsp;")
    // Les espaces consécutifs sont fusionnés par le rendu HTML → on les fige.
    .replace(/ {2,}/g, (run) => "&nbsp;".repeat(run.length))
    .replace(/\n/g, "<br>");
  // `white-space:pre-wrap` en ceinture-bretelles pour les clients tolérants.
  return `<div style="white-space:pre-wrap">${inner}</div>`;
}

/**
 * Envoie un email DEPUIS la vraie adresse de l'utilisateur (M5.6). Le compte est
 * désigné par son `account_id` Unipile (stocké dans ChannelConfig).
 * Retourne le `tracking_id` Unipile (référence externe du message envoyé).
 */
export async function sendEmail(input: {
  accountId: string;
  to: { identifier: string; display_name?: string }[];
  subject: string;
  body: string;
}): Promise<{ emailId: string | null }> {
  const ctx = getClient();
  if (!ctx) {
    console.warn(
      `[unipile] non configuré — email non envoyé à ${input.to.map((t) => t.identifier).join(", ")} : « ${input.subject} »`,
    );
    return { emailId: null };
  }
  const res = await ctx.client.email.send({
    account_id: input.accountId,
    to: input.to,
    subject: input.subject,
    body: textToHtmlBody(input.body),
  });
  return { emailId: res.tracking_id ?? null };
}

/**
 * Récupère les octets d'une pièce jointe (M5.4) pour la pousser dans R2. Le SDK
 * renvoie un `Blob` ; R2 reste notre source de vérité, Unipile n'est qu'un
 * transport.
 */
export async function fetchAttachment(input: {
  accountId: string;
  emailId: string;
  attachmentId: string;
}): Promise<{ bytes: Uint8Array; contentType: string | null }> {
  const ctx = getClient();
  if (!ctx)
    throw new Error("[unipile] non configuré — fetchAttachment impossible.");
  const blob = await ctx.client.email.getEmailAttachment({
    email_id: input.emailId,
    attachment_id: input.attachmentId,
  });
  const bytes = new Uint8Array(await blob.arrayBuffer());
  return { bytes, contentType: blob.type || null };
}

/**
 * Détails d'un compte connecté — sert à récupérer l'adresse email réelle après
 * la connexion (le webhook `notify` ne porte que l'`account_id`). Best-effort :
 * `null` si non configuré ou introuvable.
 */
export async function getAccount(
  accountId: string,
): Promise<{ name: string | null; email: string | null } | null> {
  const ctx = getClient();
  if (!ctx) return null;
  try {
    // La réponse est une union typée par provider ; l'adresse vit à différents
    // endroits (`mail.username` pour Google/Outlook OAuth, `mail.imap_user` pour
    // IMAP). On lit de façon défensive.
    const acc = (await ctx.client.account.getOne(accountId)) as unknown as {
      name?: string;
      connection_params?: {
        mail?: { username?: string; imap_user?: string };
      };
    };
    const email =
      acc.connection_params?.mail?.username ??
      acc.connection_params?.mail?.imap_user ??
      (acc.name?.includes("@") ? acc.name : null) ??
      null;
    return { name: acc.name ?? null, email };
  } catch {
    return null;
  }
}

/**
 * Enregistre (idempotence côté Unipile non garantie — à lancer une fois) le
 * webhook email entrant, avec notre header secret d'authentification. Utilitaire
 * de setup : peut être appelé depuis un script ou remplacé par la config manuelle
 * du dashboard Unipile. Retourne l'id du webhook créé, ou null si non configuré.
 */
export async function registerInboundEmailWebhook(input: {
  requestUrl: string;
  secret: string;
}): Promise<string | null> {
  const ctx = getClient();
  if (!ctx) return null;
  const res = await ctx.client.webhook.create({
    source: "email",
    request_url: input.requestUrl,
    format: "json",
    events: ["mail_received"],
    headers: [{ key: "Unipile-Auth", value: input.secret }],
    name: "relvo-inbound-email",
  });
  return (res as { webhook_id?: string }).webhook_id ?? null;
}

/** true si Unipile est configuré — utile à l'UI pour l'état « connectable ». */
export function isUnipileConfigured(): boolean {
  return loadConfig() != null;
}
