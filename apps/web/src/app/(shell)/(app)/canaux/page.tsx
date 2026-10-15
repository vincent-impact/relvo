import type { Metadata } from "next";
import { Suspense } from "react";
import { Envelope, WhatsappLogo } from "@/components/shared/picto";
import { ConnectEmailButton } from "@/components/settings/connect-email-button";
import { ChannelRemoveLink } from "@/components/settings/channel-delete-button";
import { RelvoLogo } from "@/components/layout/relvo-logo";
import { ListPanel } from "@/components/shared/list-panel";
import { ZoneHeading } from "@/components/shared/zone-heading";
import { ChannelReconnectButton } from "@/components/settings/channel-reconnect-button";
import { RelvoHeader } from "@/components/layout/relvo-header";
import { Screen } from "@/components/layout/screen";
import { RowsSkeleton } from "@/components/shared/screen-skeletons";
import { getTenantDb } from "@/server/auth-context";
import { getAccount } from "@/server/unipile";
import { type ChannelConfigStatus, setChannelConfigStatus } from "@relvo/db";
import type { TenantDb } from "@relvo/db";

export const metadata: Metadata = { title: "Canaux — Relvo" };

// Canaux — page du menu (M18) : les boîtes e-mail et messageries connectées,
// leur état, le rattrapage du courrier récent, et la connexion d'un canal.
//
// PERF : le hero s'affiche instantanément ; la liste (canaux en base) stream
// dans un <Suspense>.

// L'état se lit à la forme avant la couleur (01-tokens) : connecté = pastille
// pleine verte, en attente = pastille cerclée ambre, erreur = pleine rouge,
// désactivé = cerclée grise.
const CHANNEL_STATUS: Record<
  string,
  { label: string; cls: string; dot: string }
> = {
  connected: { label: "Connecté", cls: "text-fait", dot: "bg-fait" },
  pending: {
    label: "En attente",
    cls: "text-attente-texte",
    dot: "border-2 border-(--attente)",
  },
  error: { label: "Erreur", cls: "text-urgent", dot: "bg-urgent" },
  disabled: {
    label: "Désactivé",
    cls: "text-gris",
    dot: "border-2 border-(--gris-clair)",
  },
};

async function ChannelList() {
  const db = await getTenantDb();
  const channels = await db.channel.findMany({
    orderBy: { createdAt: "asc" },
    include: {
      config: {
        select: { status: true, lastSyncAt: true, externalAccountId: true },
      },
      // Le dernier rattrapage du courrier récent (M7.19) : ce que Relvo a lu
      // la nuit de la connexion, ou ce qu'il s'apprête à lire.
      catchups: { orderBy: { requestedAt: "desc" }, take: 1 },
    },
  });

  // Le badge dit ce que le fournisseur dit du compte, pas ce qu'on en a retenu
  // (PITFALLS #53) : une lecture par canal, en parallèle, best-effort.
  const statuts = await Promise.all(
    channels.map((ch) =>
      statutReconcilie(db, {
        channelId: ch.id,
        stored: ch.config?.status ?? "pending",
        externalAccountId: ch.config?.externalAccountId ?? null,
      }),
    ),
  );

  // Un seul canal par type (email / WhatsApp) : on masque la tuile de connexion
  // correspondante quand un canal du type existe déjà (2026-07-28). Évite de
  // complexifier l'usage et de multiplier les comptes Unipile.
  const hasEmail = channels.some((c) => c.type === "email");
  const hasWhatsApp = channels.some((c) => c.type === "whatsapp");

  return (
    <div className="pt-3">
      {/* La zone est nommée, même vide : c'est là que le libellé sert le plus. */}
      <ZoneHeading
        label="Vos boîtes"
        hint={channels.length > 0 ? `${channels.length}` : undefined}
      />
      {channels.length === 0 ? (
        // Le vide GUIDE, dans la voix de Relvo : c'est ici que la première
        // connexion aboutit (M19.9), et c'est la promesse redite une fois, à
        // l'endroit du geste. Le bouton, lui, est sous le bloc : un bouton de
        // l'utilisateur n'est jamais sur le violet pâle de Relvo.
        <section
          aria-label="Relvo"
          className="mx-4 rounded-(--rayon-carte) border border-relvo-filet bg-relvo-pale px-3.5 pt-3 pb-3 text-noir shadow-carte"
        >
          <div className="flex items-center gap-2">
            <RelvoLogo
              size={22}
              variant="full"
              className="text-relvo-clair"
              title=""
            />
            <span className="libelle text-relvo!">Relvo</span>
          </div>
          <p className="mt-1.5 text-[14px] leading-5 font-light">
            Je n’ai encore rien à lire. Reliez la boîte où arrivent vos
            fournisseurs et vos clients : je lis le courrier des dernières
            semaines et j’ouvre les premiers sujets.
          </p>
        </section>
      ) : (
        <ListPanel>
          {channels.map((ch, i) => {
            const st = CHANNEL_STATUS[statuts[i]] ?? CHANNEL_STATUS.pending;
            const Icon = ch.type === "whatsapp" ? WhatsappLogo : Envelope;
            // Reconnecter remplace le badge quand le compte existe chez le
            // fournisseur et que le canal n'est pas connecté : l'état devient
            // le geste (PITFALLS #53).
            const reconnect =
              ch.config?.externalAccountId && statuts[i] !== "connected";
            return (
              <div
                key={ch.id}
                data-list-row
                className="flex items-center gap-3 border-b border-(--filet) px-3.5 py-3"
              >
                <span className="grid size-9 flex-none place-items-center rounded-full bg-(--fond-puce) text-noir">
                  <Icon className="size-[18px]" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[14.5px] leading-[18px] font-normal text-noir">
                    {ch.name}
                  </div>
                  <div className="truncate text-[12px] font-normal text-gris">
                    {ch.identifier}
                  </div>
                  {/* La ligne de rattrapage : Relvo rend compte, dans ses mots,
                        de ce qu'il a fait de la boîte — la preuve pointée. */}
                  {ch.catchups[0] ? (
                    <div className="mt-0.5 text-[14px] leading-[18px] font-light text-relvo">
                      {libelleRattrapage(ch.catchups[0])}
                    </div>
                  ) : null}
                </div>
                {reconnect ? (
                  <ChannelReconnectButton
                    channelId={ch.id}
                    channelName={ch.name}
                  />
                ) : (
                  <span
                    className={`inline-flex flex-none items-center gap-1.5 text-[11px] font-medium tracking-[0.06em] uppercase ${st.cls}`}
                  >
                    <i
                      aria-hidden
                      className={`size-2 rounded-full ${st.dot}`}
                    />
                    {st.label}
                  </span>
                )}
              </div>
            );
          })}
        </ListPanel>
      )}
      <div className="px-4">
        <ConnectEmailButton hasEmail={hasEmail} hasWhatsApp={hasWhatsApp} />
        <ChannelRemoveLink
          channels={channels.map((c) => ({
            id: c.id,
            name: c.name,
            identifier: c.identifier,
          }))}
        />
      </div>
    </div>
  );
}

export default function CanauxPage() {
  return (
    <Screen>
      <RelvoHeader
        title="Canaux"
        subtitle="Vos boîtes e-mail et messageries"
        className="pb-5"
      />
      <Suspense fallback={<RowsSkeleton count={2} className="mt-8" />}>
        <ChannelList />
      </Suspense>
    </Screen>
  );
}

/** Au-delà, la page n'attend plus le fournisseur : elle affiche ce qu'elle sait. */
const DELAI_FOURNISSEUR_MS = 3000;

/**
 * Le statut à afficher pour un canal, réconcilié avec le fournisseur (M5.8,
 * PITFALLS #53). Le statut stocké n'est qu'un souvenir : une reconnexion
 * abandonnée ou un webhook d'état perdu le laissent faux — « En attente » sur
 * une boîte qui livre son courrier. Quand le compte existe chez le fournisseur,
 * on lui demande l'état de ses sources ; s'il diffère de ce qu'on a en base, on
 * corrige la base par le domaine et on affiche la vérité. Sans réponse (délai,
 * fournisseur non configuré, libellé inconnu), on garde ce qu'on savait. Un
 * canal désactivé par l'utilisateur n'est jamais réconcilié.
 */
async function statutReconcilie(
  db: TenantDb,
  ch: {
    channelId: string;
    stored: ChannelConfigStatus;
    externalAccountId: string | null;
  },
): Promise<ChannelConfigStatus> {
  if (!ch.externalAccountId || ch.stored === "disabled") return ch.stored;
  const live = await avecDelai(getAccount(ch.externalAccountId));
  const status = live?.status ?? null;
  if (!status || status === ch.stored) return ch.stored;
  try {
    await setChannelConfigStatus(db, ch.channelId, status, new Date());
  } catch (err) {
    console.error(
      "[canaux] statut non réconcilié",
      { channelId: ch.channelId },
      err,
    );
  }
  return status;
}

/** `null` si la promesse n'a pas répondu dans le délai — jamais une erreur. */
function avecDelai<T>(promise: Promise<T>): Promise<T | null> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const delai = new Promise<null>((resolve) => {
    timer = setTimeout(() => resolve(null), DELAI_FOURNISSEUR_MS);
  });
  return Promise.race([promise.catch(() => null), delai]).finally(() =>
    clearTimeout(timer),
  );
}

/**
 * Le rattrapage du courrier récent, en une ligne sous le canal (M7.19) : ce
 * que Relvo va lire, lit, ou a lu — et pourquoi il s'est arrêté. Le
 * vocabulaire est celui de l'utilisateur, jamais celui du pipeline.
 */
function libelleRattrapage(c: {
  status: string;
  messagesImported: number;
  subjectsOpened: number;
  conversationsIgnored: number;
  stopReason: string | null;
}): string {
  // « ignorée » : le mot de Conversations, pas « sourdine ».
  const bilan = `${c.messagesImported} message${c.messagesImported > 1 ? "s" : ""} lu${c.messagesImported > 1 ? "s" : ""}, ${c.subjectsOpened} sujet${c.subjectsOpened > 1 ? "s" : ""} ouvert${c.subjectsOpened > 1 ? "s" : ""}, ${c.conversationsIgnored} ignorée${c.conversationsIgnored > 1 ? "s" : ""}`;
  switch (c.status) {
    case "pending":
      return "Relvo lira le courrier des dernières semaines cette nuit.";
    case "running":
      return `Relvo lit le courrier des dernières semaines — ${bilan}.`;
    case "done":
      return `Courrier récent lu : ${bilan}.`;
    case "capped":
      return `Courrier récent lu jusqu'au plafond : ${bilan}. Le reste se trie au fil de l'eau.`;
    default:
      return `La lecture du courrier récent a été interrompue — ${bilan}.`;
  }
}
