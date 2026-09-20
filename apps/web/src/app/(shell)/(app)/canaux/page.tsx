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
            const st =
              CHANNEL_STATUS[ch.config?.status ?? "pending"] ??
              CHANNEL_STATUS.pending;
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
                {/* Reconnecter (ré-auth du même compte, sans perte) — proposé
                    dès qu'un compte fournisseur existe. */}
                {ch.config?.externalAccountId ? (
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
