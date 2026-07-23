"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CalendarDays, Info, MessagesSquare, Settings } from "lucide-react";
import { SegTabs, type SegTabOption } from "@/components/shared/seg-tabs";
import {
  MessageBubble,
  type MessageBubbleData,
} from "@/components/shared/message-bubble";
import { EmailMessage } from "@/components/conversations/email-message";
import {
  RecipientComposer,
  type Recipient,
} from "@/components/shared/recipient-composer";
import {
  ConversationSelector,
  type SubjectConversationOption,
} from "@/components/subject/conversation-selector";
import { sendEmailReplyAction } from "@/server/actions/email";
import { sendWhatsAppReplyAction } from "@/server/actions/whatsapp";
import { ensureSubjectAnchorsAction } from "@/server/actions/subject-conversations";

// Orchestrateur de la fiche Sujet (corps interactif) — possède l'ONGLET ACTIF et
// l'INTERLOCUTEUR sélectionné, partagés entre le fil (zone scrollable) et le
// composer (collé en bas, hors du scroll). Permet :
//  - de n'afficher le composer QUE dans l'onglet « Conversations » ;
//  - de FILTRER le fil sur l'interlocuteur choisi dans le select du composer
//    (un sujet peut porter plusieurs interlocuteurs) — « Tous » = fil complet.
// Le header et les panneaux Tâches/Détails sont des Server Components passés en
// props (rendus côté serveur, simplement insérés ici).

type Tab = "informations" | "messages" | "taches" | "detail";

export function SubjectBody({
  header,
  defaultTab = "informations",
  tasksCount,
  bubbles,
  draft,
  informationsPane,
  tachesPane,
  detailPane,
  interlocuteurs,
  conversations = [],
  defaultInterlocuteurKey,
  subjectId,
  subjectTitle,
  emailReplyTargets,
  whatsappReplyTargets,
  isGroupSubject = false,
  groupWhatsappTarget = null,
}: {
  header: React.ReactNode;
  defaultTab?: Tab;
  tasksCount: number;
  bubbles: MessageBubbleData[];
  draft: React.ReactNode;
  /** Onglet Informations — descriptif éditable + rapport d'activité Relvo. */
  informationsPane: React.ReactNode;
  tachesPane: React.ReactNode;
  detailPane: React.ReactNode;
  /** Interlocuteurs du sujet (key = id du contact). */
  interlocuteurs: Recipient[];
  /** Conversations du sujet (M6ter) — sélecteur + feuille des écoutes. */
  conversations?: SubjectConversationOption[];
  /** Dernier interlocuteur actif (sélection par défaut), ou null. */
  defaultInterlocuteurKey: string | null;
  subjectId: string;
  subjectTitle: string;
  /** Par interlocuteur joignable par email : son adresse + le canal à utiliser. */
  emailReplyTargets: Record<string, { channelId: string; email: string }>;
  /** Par interlocuteur joignable par WhatsApp : le fil (chat_id) + le canal. */
  whatsappReplyTargets: Record<string, { channelId: string; chatId: string }>;
  /** Sujet issu d'un GROUPE WhatsApp (1 groupe = 1 sujet) → réponse à Tous par
   *  défaut, pas à un membre (invariant : le groupe est l'interlocuteur). */
  isGroupSubject?: boolean;
  /** Fil du groupe (chat_id + canal) pour l'envoi « Tous » réel, ou null. */
  groupWhatsappTarget?: { channelId: string; chatId: string } | null;
}) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>(defaultTab);
  const multi = interlocuteurs.length > 1;
  // Sujet de groupe → « Tous » est l'interlocuteur par défaut (le groupe entier).
  const [selected, setSelected] = useState<string>(
    isGroupSubject
      ? "all"
      : (defaultInterlocuteurKey ?? interlocuteurs[0]?.key ?? "all"),
  );

  // Après un envoi réussi : on pose les ancres manquantes. Une conversation
  // ajoutée par le cas S est rattachée AVANT que le moindre message n'existe —
  // c'est le premier message envoyé qui devient son ancre, donc le point de
  // départ de la fenêtre sur ce nouveau fil. Idempotent : sans effet si tout est
  // déjà ancré (le cas courant).
  async function afterSend() {
    await ensureSubjectAnchorsAction(subjectId);
    router.refresh();
  }

  // Envoi réel d'une réponse (M5.6 email / M6.5 WhatsApp), routé selon le canal
  // par lequel l'interlocuteur est joignable. Retourne `false` pour que le
  // composer NE vide PAS le champ si l'envoi n'a pas eu lieu (texte préservé).
  async function handleSend(text: string, recipientKey: string) {
    if (recipientKey === "all") {
      // Groupe WhatsApp : « Tous » = le fil du groupe (chat_id) → UN SEUL envoi
      // réel (ce n'est pas la diffusion fan-out email, reportée après la V1).
      if (isGroupSubject && groupWhatsappTarget) {
        const res = await sendWhatsAppReplyAction({
          subjectId,
          channelId: groupWhatsappTarget.channelId,
          chatId: groupWhatsappTarget.chatId,
          body: text,
        });
        if (!res.ok) {
          toast.error(res.message);
          return false;
        }
        toast.success("Message envoyé au groupe");
        await afterSend();
        return true;
      }
      toast.info("La diffusion à tous les interlocuteurs arrive après la V1.");
      return false;
    }
    const name = interlocuteurs.find((r) => r.key === recipientKey)?.name;

    // Email prioritaire s'il est disponible ; sinon WhatsApp (fil existant).
    const emailTarget = emailReplyTargets[recipientKey];
    if (emailTarget) {
      const res = await sendEmailReplyAction({
        subjectId,
        channelId: emailTarget.channelId,
        to: { identifier: emailTarget.email, displayName: name },
        recipientContactId: recipientKey,
        subject: `Re: ${subjectTitle}`,
        body: text,
      });
      if (!res.ok) {
        toast.error(res.message);
        return false;
      }
      toast.success("Email envoyé");
      await afterSend();
      return true;
    }

    const waTarget = whatsappReplyTargets[recipientKey];
    if (waTarget) {
      const res = await sendWhatsAppReplyAction({
        subjectId,
        channelId: waTarget.channelId,
        chatId: waTarget.chatId,
        recipientContactId: recipientKey,
        body: text,
      });
      if (!res.ok) {
        toast.error(res.message);
        return false;
      }
      toast.success("Message WhatsApp envoyé");
      await afterSend();
      return true;
    }

    toast.error(
      "Réponse indisponible pour cet interlocuteur (aucun email ni fil WhatsApp connu).",
    );
    return false;
  }

  // Onglets à ICÔNES (2026-07-23) — 4 entrées tiennent sur mobile sans rogner
  // l'horizontal. Ordre : Informations · Tâches · Conversations · Détails.
  const options: SegTabOption[] = [
    { value: "informations", label: "Informations", icon: Info },
    { value: "taches", label: "Tâches", icon: CalendarDays, count: tasksCount },
    { value: "messages", label: "Conversations", icon: MessagesSquare },
    { value: "detail", label: "Détails", icon: Settings },
  ];

  // Destinataire « tout le monde » en tête du select : « Groupe » pour un sujet
  // de groupe WhatsApp (icône groupe → on s'adresse à tous les participants),
  // « Tous » pour une diffusion multi-interlocuteurs classique (> 1 contact).
  const composerRecipients: Recipient[] =
    isGroupSubject || multi
      ? [
          {
            key: "all",
            name: isGroupSubject ? "Groupe" : "Tous",
            kind: "all",
          },
          ...interlocuteurs,
        ]
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
          iconOnly
        />

        {tab === "informations" ? informationsPane : null}

        {tab === "messages" && conversations.length > 0 ? (
          // Ligne unique + feuille des écoutes (M6ter, invariant n°11) — sélecteur
          // ET gestion des écoutes. Synchronisé avec le composer via `selected`
          // (la clé d'une conversation = son contact, « all » pour un groupe).
          <ConversationSelector
            conversations={conversations}
            selectedKey={selected}
            onSelect={setSelected}
            subjectId={subjectId}
          />
        ) : null}

        {tab === "messages" ? (
          <div className="flex flex-col gap-[15px] px-2.5 pt-4 pb-3">
            {shown.length === 0 ? (
              <p className="text-[13.5px] text-(--text-tertiary)">
                {bubbles.length === 0
                  ? "Aucun message."
                  : "Aucun message avec cet interlocuteur."}
              </p>
            ) : (
              // Rendu par canal, IDENTIQUE au fil de conversation (homogénéité) :
              // e-mail pleine largeur + HTML isolé, WhatsApp en bulle. Le tap est
              // réservé aux pièces jointes — plus de pop-up de message.
              shown.map((b) =>
                b.channelType === "email" ? (
                  <EmailMessage key={b.id} data={b} />
                ) : (
                  <MessageBubble key={b.id} data={b} />
                ),
              )
            )}
            {draft}
          </div>
        ) : null}

        {tab === "taches" ? tachesPane : null}
        {tab === "detail" ? detailPane : null}
      </main>

      {tab === "messages" && (interlocuteurs.length > 0 || isGroupSubject) ? (
        <RecipientComposer
          recipients={composerRecipients}
          value={selected}
          onSend={handleSend}
        />
      ) : null}
    </>
  );
}
