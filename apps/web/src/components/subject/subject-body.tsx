"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { SegTabs, type SegTabOption } from "@/components/shared/seg-tabs";
import {
  MessageBubble,
  type MessageBubbleData,
} from "@/components/shared/message-bubble";
import {
  RecipientComposer,
  type Recipient,
} from "@/components/shared/recipient-composer";
import { sendEmailReplyAction } from "@/server/actions/email";

// Orchestrateur de la fiche Sujet (corps interactif) — possède l'ONGLET ACTIF et
// l'INTERLOCUTEUR sélectionné, partagés entre le fil (zone scrollable) et le
// composer (collé en bas, hors du scroll). Permet :
//  - de n'afficher le composer QUE dans l'onglet « Conversations » ;
//  - de FILTRER le fil sur l'interlocuteur choisi dans le select du composer
//    (un sujet peut porter plusieurs interlocuteurs) — « Tous » = fil complet.
// Le header et les panneaux Tâches/Détails sont des Server Components passés en
// props (rendus côté serveur, simplement insérés ici).

type Tab = "messages" | "taches" | "detail";

export function SubjectBody({
  header,
  defaultTab = "messages",
  tasksCount,
  bubbles,
  draft,
  tachesPane,
  detailPane,
  interlocuteurs,
  defaultInterlocuteurKey,
  subjectId,
  subjectTitle,
  emailReplyTargets,
}: {
  header: React.ReactNode;
  defaultTab?: Tab;
  tasksCount: number;
  bubbles: MessageBubbleData[];
  draft: React.ReactNode;
  tachesPane: React.ReactNode;
  detailPane: React.ReactNode;
  /** Interlocuteurs du sujet (key = id du contact). */
  interlocuteurs: Recipient[];
  /** Dernier interlocuteur actif (sélection par défaut), ou null. */
  defaultInterlocuteurKey: string | null;
  subjectId: string;
  subjectTitle: string;
  /** Par interlocuteur joignable par email : son adresse + le canal à utiliser. */
  emailReplyTargets: Record<string, { channelId: string; email: string }>;
}) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>(defaultTab);
  const multi = interlocuteurs.length > 1;
  const [selected, setSelected] = useState<string>(
    defaultInterlocuteurKey ?? interlocuteurs[0]?.key ?? "all",
  );

  // Envoi réel d'une réponse email (M5.6). Retourne `false` pour que le composer
  // NE vide PAS le champ si l'envoi n'a pas eu lieu (texte préservé).
  async function handleSend(text: string, recipientKey: string) {
    if (recipientKey === "all") {
      toast.info("La diffusion à tous les interlocuteurs arrive après la V1.");
      return false;
    }
    const target = emailReplyTargets[recipientKey];
    if (!target) {
      toast.error(
        "Réponse email indisponible pour cet interlocuteur (pas d'email connu, ou canal WhatsApp).",
      );
      return false;
    }
    const name = interlocuteurs.find((r) => r.key === recipientKey)?.name;
    const res = await sendEmailReplyAction({
      subjectId,
      channelId: target.channelId,
      to: { identifier: target.email, displayName: name },
      recipientContactId: recipientKey,
      subject: `Re: ${subjectTitle}`,
      body: text,
    });
    if (!res.ok) {
      toast.error(res.message);
      return false;
    }
    toast.success("Email envoyé");
    router.refresh();
    return true;
  }

  const options: SegTabOption[] = [
    { value: "taches", label: "Tâches", count: tasksCount },
    { value: "messages", label: "Conversations" },
    { value: "detail", label: "Détails" },
  ];

  // « Tous » (diffusion) proposé en tête du select dès qu'il y a > 1 interlocuteur.
  const composerRecipients: Recipient[] = multi
    ? [{ key: "all", name: "Tous", kind: "all" }, ...interlocuteurs]
    : interlocuteurs;

  // Fil filtré : « Tous » (ou sujet mono-interlocuteur) → tout ; sinon les
  // messages où l'interlocuteur est l'expéditeur (entrant) ou le destinataire
  // (sortant).
  const shown =
    selected === "all" || !multi
      ? bubbles
      : bubbles.filter(
          (b) =>
            b.senderContactId === selected || b.recipientContactId === selected,
        );

  return (
    <>
      <main className="min-h-0 flex-1 overflow-y-auto bg-white">
        {header}
        <SegTabs
          options={options}
          value={tab}
          onValueChange={(v) => setTab(v as Tab)}
          overlap
        />

        {tab === "messages" ? (
          <div className="flex flex-col gap-[15px] px-[18px] pt-4 pb-3">
            {shown.length === 0 ? (
              <p className="text-[13.5px] text-(--text-tertiary)">
                {bubbles.length === 0
                  ? "Aucun message."
                  : "Aucun message avec cet interlocuteur."}
              </p>
            ) : (
              shown.map((b) => <MessageBubble key={b.id} data={b} />)
            )}
            {draft}
          </div>
        ) : null}

        {tab === "taches" ? tachesPane : null}
        {tab === "detail" ? detailPane : null}
      </main>

      {tab === "messages" && interlocuteurs.length > 0 ? (
        <RecipientComposer
          recipients={composerRecipients}
          value={selected}
          onRecipientChange={setSelected}
          onSend={handleSend}
        />
      ) : null}
    </>
  );
}
