import type { Metadata } from "next";
import { Suspense } from "react";
import { MessageCircle, Mail } from "lucide-react";
import { ConnectEmailButton } from "@/components/settings/connect-email-button";
import { ChannelDeleteButton } from "@/components/settings/channel-delete-button";
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

const CHANNEL_STATUS: Record<string, { label: string; cls: string }> = {
  connected: { label: "Connecté", cls: "bg-(--green-50) text-(--green-600)" },
  pending: { label: "En attente", cls: "bg-(--amber-50) text-(--amber-800)" },
  error: { label: "Erreur", cls: "bg-(--red-50) text-(--red-600)" },
  disabled: {
    label: "Désactivé",
    cls: "bg-(--surface-2) text-(--text-tertiary)",
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
    <div className="px-4 pt-5">
      <div className="overflow-hidden rounded-2xl border border-(--border-light) bg-white shadow-(--shadow-card)">
        {channels.length === 0 ? (
          <p className="p-5 text-center text-[13.5px] text-(--text-tertiary)">
            Aucun canal connecté.
          </p>
        ) : (
          channels.map((ch, i) => {
            const st = CHANNEL_STATUS[statuts[i]] ?? CHANNEL_STATUS.pending;
            const Icon = ch.type === "whatsapp" ? MessageCircle : Mail;
            return (
              <div
                key={ch.id}
                className={`flex items-center gap-3 px-4 py-3.5 ${i > 0 ? "border-t border-(--border-light)" : ""}`}
              >
                <span className="grid size-9 flex-none place-items-center rounded-xl bg-(--surface-2) text-(--text-secondary)">
                  <Icon className="size-[18px]" strokeWidth={2} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[14.5px] font-semibold">
                    {ch.name}
                  </div>
                  <div className="truncate text-[12.5px] text-(--text-tertiary)">
                    {ch.identifier}
                  </div>
                  {ch.catchups[0] ? (
                    <div className="truncate text-[12px] text-relvo">
                      {libelleRattrapage(ch.catchups[0])}
                    </div>
                  ) : null}
                </div>
                <span
                  className={`flex-none rounded-full px-2.5 py-1 text-[11px] font-bold ${st.cls}`}
                >
                  {st.label}
                </span>
                {/* Reconnecter (ré-auth du même compte, sans perte) — seulement
                    quand le compte existe chez le fournisseur ET que le canal
                    n'est pas connecté : sur un canal qui marche, l'icône se
                    lisait comme un « rafraîchir » (PITFALLS #53). */}
                {ch.config?.externalAccountId && statuts[i] !== "connected" ? (
                  <ChannelReconnectButton
                    channelId={ch.id}
                    channelName={ch.name}
                  />
                ) : null}
                <ChannelDeleteButton channelId={ch.id} channelName={ch.name} />
              </div>
            );
          })
        )}
      </div>
      <ConnectEmailButton hasEmail={hasEmail} hasWhatsApp={hasWhatsApp} />
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
      <Suspense fallback={<RowsSkeleton count={2} />}>
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
  const bilan = `${c.messagesImported} message${c.messagesImported > 1 ? "s" : ""} lu${c.messagesImported > 1 ? "s" : ""}, ${c.subjectsOpened} sujet${c.subjectsOpened > 1 ? "s" : ""} ouvert${c.subjectsOpened > 1 ? "s" : ""}, ${c.conversationsIgnored} mis${c.conversationsIgnored > 1 ? "es" : "e"} en sourdine`;
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
