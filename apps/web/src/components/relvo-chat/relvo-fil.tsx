"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { getToolName, isToolUIPart, type UIMessagePart } from "ai";
import { toast } from "sonner";
import type { ConnaissanceTrouvee, MessageTrouve } from "@relvo/db";
import {
  RelvoBlock,
  RelvoSentence,
  RELVO_LINK,
} from "@/components/shared/relvo-block";
import { CarteVivante } from "@/components/shared/carte-vivante";
import { MessageBubble } from "@/components/shared/message-bubble";
import {
  SubjectRow,
  type SubjectRowData,
} from "@/components/shared/subject-row";
import { TaskItem, type TaskItemData } from "@/components/subject/task-item";
import type {
  ConversationLigne,
  OutilsRelvoUI,
  RelvoUIMessage,
  SortieOutil,
} from "@/server/ia/echange/outils";
import { annulable, type Annulation } from "@/lib/relvo-annulation";
import { phraseArret, phraseErreur } from "@/lib/echange-erreurs";
import { annulerGesteAction } from "@/server/actions/relvo";
import { cn } from "@/lib/utils";

// Le FIL de l'échange avec Relvo (M10.9, M10.10, M10.14) — ce que le dirigeant lit.
//
// Un tour du dirigeant est la bulle sortante des conversations ; un tour de
// Relvo est UN bloc de Relvo, dans lequel le texte arrive en flux et où chaque
// outil appelé se rend en BLOC : d'abord « je regarde… », puis le résultat avec
// les composants des écrans — une affaire est une ligne d'affaire, une tâche
// une ligne de tâche (01 §11 « Relvo rend les mêmes composants que
// l'interface », invariant 31). Jamais une liste à puces pour ce que le produit
// sait rendre. Une action faite est une phrase signée ✦ avec [Voir] et
// [Annuler] (05 §11.6) : « Annuler » défait par la même fonction du domaine
// que l'écran (`defaireGeste`), et reste actif quelques minutes — au-delà, le
// geste se défait par les écrans habituels.
//
// Une affaire ou une tâche citée dans un bloc de Relvo est une SOUS-CARTE à
// filet, sans ombre (02-composants : une carte ne contient pas une carte).

type Part = UIMessagePart<never, OutilsRelvoUI>;

/** Le texte de Relvo : des paragraphes, et rien d'autre. Un Markdown égaré est aplani. */
export function TexteRelvo({ texte }: { texte: string }) {
  const paragraphes = texte
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .split(/\n{2,}/)
    .map((p) => p.replace(/^\s*[-•]\s+/gm, "").trim())
    .filter(Boolean);
  return (
    <>
      {paragraphes.map((p, i) => (
        <RelvoSentence key={i} className="whitespace-pre-line">
          {p}
        </RelvoSentence>
      ))}
    </>
  );
}

function Respire({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "respire inline-flex items-center gap-[3px] align-middle text-relvo",
        className,
      )}
      aria-hidden
    >
      {[0, 1, 2].map((i) => (
        <span key={i} className="size-[4px] rounded-full bg-current" />
      ))}
    </span>
  );
}

/** La sous-carte d'un bloc de Relvo : filet, blanc, sans ombre ; le dernier rang sans filet. */
function SousCarte({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-2.5 overflow-hidden rounded-(--rayon-sous-carte) border border-(--filet) bg-white [&>*:last-child_[data-list-row]]:border-b-0 [&>[data-list-row]:last-child]:border-b-0">
      {children}
    </div>
  );
}

const EN_COURS: Record<keyof OutilsRelvoUI, string> = {
  list_subjects: "Je regarde vos affaires",
  get_subject: "Je lis la fiche",
  list_tasks: "Je regarde vos tâches",
  get_kpis: "Je compte",
  list_contacts: "Je cherche dans l'annuaire",
  get_contact: "Je cherche dans l'annuaire",
  search_messages: "Je cherche dans vos messages",
  list_conversations: "Je regarde vos conversations",
  search_knowledge: "Je cherche dans la Mémoire",
  get_mail_reading: "Je regarde où j'en suis",
  create_task: "Je crée la tâche",
  update_task: "Je modifie la tâche",
  mark_task_done: "Je coche la tâche",
  mark_task_deleted: "Je retire la tâche",
  create_subject: "J'ouvre l'affaire",
  update_subject_status: "Je change l'état de l'affaire",
  update_subject_priority: "Je change la priorité",
  update_subject_summary: "Je récris le résumé",
  create_message_draft: "Je prépare le brouillon",
  create_knowledge_note: "J'écris l'instruction",
  update_knowledge_note: "Je modifie l'instruction",
  delete_knowledge_note: "Je retire l'instruction",
};

/**
 * Un GESTE de Relvo dans le fil : la phrase signée ✦, l'objet rendu, puis
 * [Voir] et [Annuler]. « Annuler » appelle la server action qui défait par le
 * domaine ; le bloc se marque alors « annulé » et ne propose plus rien.
 */
function BlocAction({
  phrase,
  voir,
  annulation,
  children,
}: {
  phrase: React.ReactNode;
  /** La porte vers l'objet : href et libellé. */
  voir: { href: string; label: string } | null;
  annulation: Annulation;
  children?: React.ReactNode;
}) {
  const [etat, setEtat] = useState<"fait" | "annule">("fait");
  const [pending, start] = useTransition();
  const actif = etat === "fait" && annulable(annulation);
  function annuler() {
    start(async () => {
      const res = await annulerGesteAction(annulation);
      if (res.ok) {
        setEtat("annule");
        toast.success(res.data.fait);
      } else {
        toast.error(res.message);
      }
    });
  }
  if (etat === "annule") {
    return (
      <RelvoSentence className="text-gris line-through decoration-(--gris-clair)">
        {phrase}
      </RelvoSentence>
    );
  }
  return (
    <>
      <RelvoSentence>✦ {phrase}</RelvoSentence>
      {children}
      <div className="mt-1 flex items-center gap-4">
        {voir ? (
          <Link href={voir.href} className={cn(RELVO_LINK, "py-1")}>
            → {voir.label}
          </Link>
        ) : null}
        <button
          type="button"
          onClick={annuler}
          disabled={!actif || pending}
          className={cn(
            "py-1 text-[14px] font-medium",
            actif ? "text-relvo active:opacity-80" : "text-gris opacity-60",
          )}
        >
          {pending ? "Annulation…" : "Annuler"}
        </button>
      </div>
    </>
  );
}

function Messages({ messages }: { messages: MessageTrouve[] }) {
  if (messages.length === 0) return null;
  return (
    <SousCarte>
      {messages.map((m) => (
        <Link
          key={m.id}
          href={`/conversations/${m.conversationId}`}
          data-list-row
          className="block border-b border-(--filet) px-3.5 py-2.5 active:bg-(--fond-enfonce)"
        >
          <span className="flex items-baseline justify-between gap-2">
            <span className="truncate text-[14.5px] font-medium text-noir">
              {m.sens === "sortant" ? "Moi" : (m.expediteur ?? "Externe")}
            </span>
            <span className="flex-none text-[12px] font-normal text-gris">
              {jourCourt(m.recuLe)}
            </span>
          </span>
          {m.objet ? (
            <span className="block truncate text-[13px] font-normal text-noir">
              {m.objet}
            </span>
          ) : null}
          <span className="line-clamp-2 text-[12.5px] leading-4 font-normal text-gris">
            {m.extrait}
          </span>
        </Link>
      ))}
    </SousCarte>
  );
}

function Conversations({
  conversations,
}: {
  conversations: ConversationLigne[];
}) {
  if (conversations.length === 0) return null;
  return (
    <SousCarte>
      {conversations.map((c) => (
        <Link
          key={c.id}
          href={`/conversations/${c.id}`}
          data-list-row
          className="block border-b border-(--filet) px-3.5 py-2.5 active:bg-(--fond-enfonce)"
        >
          <span className="flex items-baseline justify-between gap-2">
            <span className="truncate text-[14.5px] font-medium text-noir">
              {c.titre}
            </span>
            <span className="flex flex-none items-center gap-1.5 text-[12px] font-normal text-gris">
              {c.nonLus > 0 ? (
                <span className="chiffre rounded-full bg-relvo px-1.5 text-[11px] leading-4 text-white tabular-nums">
                  {c.nonLus}
                </span>
              ) : null}
              {c.dernierMessageLe ? jourCourt(c.dernierMessageLe) : null}
            </span>
          </span>
          {c.interlocuteur ? (
            <span className="block truncate text-[13px] font-normal text-noir">
              {c.interlocuteur}
              <span className="text-gris">
                {" · "}
                {c.canal === "whatsapp" ? "WhatsApp" : "E-mail"}
              </span>
            </span>
          ) : null}
          <span className="line-clamp-2 text-[12.5px] leading-4 font-normal text-gris">
            {c.apercu}
          </span>
        </Link>
      ))}
    </SousCarte>
  );
}

function Memoire({ connaissances }: { connaissances: ConnaissanceTrouvee[] }) {
  if (connaissances.length === 0) return null;
  return (
    <SousCarte>
      {connaissances.map((k) => (
        <Link
          key={k.id}
          href={`/memoire/${k.folderId}`}
          data-list-row
          className="block border-b border-(--filet) px-3.5 py-2.5 active:bg-(--fond-enfonce)"
        >
          <span className="flex items-baseline justify-between gap-2">
            <span className="truncate text-[14.5px] font-medium text-noir">
              {k.titre}
            </span>
            <span className="flex-none text-[12px] font-normal text-gris">
              {k.domaine}
              {!k.active ? " · désactivée" : ""}
            </span>
          </span>
          {k.contenu ? (
            <span className="line-clamp-2 text-[12.5px] leading-4 font-normal text-gris">
              {k.contenu}
            </span>
          ) : null}
        </Link>
      ))}
    </SousCarte>
  );
}

function Affaires({ affaires }: { affaires: SubjectRowData[] }) {
  if (affaires.length === 0) return null;
  return (
    <SousCarte>
      {affaires.map((a) => (
        <SubjectRow key={a.id} data={a} />
      ))}
    </SousCarte>
  );
}

function Taches({
  taches,
  flat = true,
}: {
  taches: TaskItemData[];
  /** false : les tâches d'UNE affaire déjà montrée — son titre ne se répète pas sous chaque ligne. */
  flat?: boolean;
}) {
  if (taches.length === 0) return null;
  return (
    <SousCarte>
      {taches.map((t) => (
        <TaskItem key={t.id} task={t} flat={flat} meta="date" />
      ))}
    </SousCarte>
  );
}

function Sortie({ sortie }: { sortie: SortieOutil }) {
  switch (sortie.type) {
    case "affaires":
      return sortie.affaires.length ? (
        <Affaires affaires={sortie.affaires} />
      ) : null;
    case "affaire":
      return (
        <>
          <Affaires affaires={[sortie.affaire]} />
          <Taches taches={sortie.taches} flat={false} />
        </>
      );
    case "taches":
      return <Taches taches={sortie.taches} />;
    case "lecture":
      // La même carte que l'échange et Canaux (01 §11 : Relvo rend les
      // composants du produit), le nom de la boîte quand il y en a plusieurs.
      return (
        <div className="mt-2.5 space-y-2">
          {sortie.lectures.map((l) => (
            <CarteVivante
              key={l.boite}
              data={{
                ...l,
                channelName: sortie.lectures.length > 1 ? l.boite : null,
              }}
            />
          ))}
        </div>
      );
    case "indicateurs":
      return (
        <SousCarte>
          {sortie.lignes.map((l) => (
            <div
              key={l.libelle}
              data-list-row
              className="flex items-center justify-between border-b border-(--filet) px-3.5 py-2"
            >
              <span className="text-[14px] font-normal text-noir">
                {l.libelle}
              </span>
              <span className="chiffre text-[20px] leading-6 text-noir tabular-nums">
                {l.valeur}
              </span>
            </div>
          ))}
        </SousCarte>
      );
    case "contacts":
      return sortie.contacts.length ? (
        <SousCarte>
          {sortie.contacts.map((c) => (
            <Link
              key={c.id}
              href={`/contacts/${c.id}`}
              data-list-row
              className="block border-b border-(--filet) px-3.5 py-2.5 active:bg-(--fond-enfonce)"
            >
              <span className="block text-[14.5px] font-medium text-noir">
                {c.nom}
              </span>
              {c.entreprise || c.email || c.telephone ? (
                <span className="block truncate text-[12px] font-normal text-gris">
                  {[c.entreprise, c.email ?? c.telephone]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
              ) : null}
            </Link>
          ))}
        </SousCarte>
      ) : null;
    case "contact":
      return (
        <>
          <Sortie sortie={{ type: "contacts", contacts: [sortie.contact] }} />
          <Affaires affaires={sortie.affaires} />
        </>
      );
    case "messages":
      return <Messages messages={sortie.messages} />;
    case "conversations":
      return <Conversations conversations={sortie.conversations} />;
    case "memoire":
      return <Memoire connaissances={sortie.connaissances} />;
    case "tache-creee":
    case "tache-modifiee":
    case "tache-cochee": {
      const t = sortie.tache;
      const verbe =
        sortie.type === "tache-creee"
          ? "J’ai créé la tâche"
          : sortie.type === "tache-modifiee"
            ? "J’ai modifié la tâche"
            : "J’ai coché la tâche";
      return (
        <BlocAction
          phrase={
            <>
              {verbe} <span className="font-medium">« {t.title} »</span>
              {sortie.type === "tache-creee" && t.subjectTitle
                ? ` dans ${t.subjectTitle}`
                : ""}
              .
            </>
          }
          voir={{
            href: t.subjectId ? `/sujets/${t.subjectId}` : "/calendrier",
            label: "Voir",
          }}
          annulation={sortie.annulation}
        >
          <Taches taches={[t]} />
        </BlocAction>
      );
    }
    case "tache-supprimee":
      return (
        <BlocAction
          phrase={
            <>
              J’ai retiré la tâche{" "}
              <span className="font-medium">« {sortie.titre} »</span>.
            </>
          }
          voir={null}
          annulation={sortie.annulation}
        />
      );
    case "affaire-creee":
      return (
        <BlocAction
          phrase={
            <>
              J’ai ouvert l’affaire{" "}
              <span className="font-medium">« {sortie.affaire.title} »</span>.
            </>
          }
          voir={{ href: `/sujets/${sortie.affaire.id}`, label: "Voir" }}
          annulation={sortie.annulation}
        >
          <Affaires affaires={[sortie.affaire]} />
        </BlocAction>
      );
    case "affaire-modifiee":
      return (
        <BlocAction
          phrase={
            <>
              <span className="font-medium">« {sortie.affaire.title} »</span> :{" "}
              {sortie.geste}.
            </>
          }
          voir={{ href: `/sujets/${sortie.affaire.id}`, label: "Voir" }}
          annulation={sortie.annulation}
        >
          <Affaires affaires={[sortie.affaire]} />
        </BlocAction>
      );
    case "brouillon":
      return (
        <BlocAction
          phrase={
            <>
              J’ai préparé un brouillon pour {sortie.contact}. Rien n’est envoyé
              : vous le relisez, puis vous l’envoyez.
            </>
          }
          voir={{
            href: `/conversations/${sortie.conversationId}?repondre=${sortie.taskId}&from=%2Frelvo`,
            label: "Aller au brouillon",
          }}
          annulation={sortie.annulation}
        >
          <div className="mt-2.5 rounded-(--rayon-sous-carte) border border-(--filet) bg-white px-3.5 py-2.5">
            <p className="line-clamp-4 text-[13.5px] leading-[18px] font-light whitespace-pre-line text-noir">
              {sortie.extrait}
            </p>
            {sortie.sources.length ? (
              <p className="mt-1.5 text-[12px] font-normal text-gris">
                Basé sur : {sortie.sources.join(", ")}
              </p>
            ) : null}
          </div>
        </BlocAction>
      );
    case "note":
      return (
        <BlocAction
          phrase={
            <>
              Instruction{" "}
              <span className="font-medium">« {sortie.titre} »</span>{" "}
              {sortie.geste}
              {sortie.geste === "créée" ? ` dans ${sortie.domaine}` : ""}.
            </>
          }
          voir={{
            href: `/memoire/${sortie.folderId}`,
            label: "Voir dans la Mémoire",
          }}
          annulation={sortie.annulation}
        />
      );
    case "introuvable":
    case "erreur":
      return null;
  }
}

function BlocOutil({ part }: { part: Part }) {
  if (!isToolUIPart<OutilsRelvoUI>(part)) return null;
  const nom = getToolName(part) as keyof OutilsRelvoUI;
  switch (part.state) {
    case "input-streaming":
    case "input-available":
      return (
        <RelvoSentence className="text-gris">
          {EN_COURS[nom] ?? "Je regarde"}
          <Respire className="ml-1" />
        </RelvoSentence>
      );
    case "output-available":
      return <Sortie sortie={part.output as SortieOutil} />;
    case "output-error":
      return (
        <RelvoSentence className="text-gris">
          Je n’ai pas pu faire ça.
        </RelvoSentence>
      );
    default:
      return null;
  }
}

function TourRelvo({ message }: { message: RelvoUIMessage }) {
  const parts = message.parts as Part[];
  const visibles = parts.filter(
    (p) => (p.type === "text" && p.text.trim()) || isToolUIPart(p),
  );
  const arret = message.metadata?.arret ?? null;
  if (visibles.length === 0 && !arret) return null;
  return (
    <RelvoBlock className="pb-2.5">
      {visibles.map((p, i) =>
        p.type === "text" ? (
          <TexteRelvo key={i} texte={p.text} />
        ) : (
          <BlocOutil key={i} part={p} />
        ),
      )}
      {arret ? (
        <RelvoSentence className="text-gris">
          {phraseArret(arret)}
        </RelvoSentence>
      ) : null}
    </RelvoBlock>
  );
}

function TourDirigeant({ message }: { message: RelvoUIMessage }) {
  const texte = message.parts
    .filter((p) => p.type === "text")
    .map((p) => p.text)
    .join("\n")
    .trim();
  if (!texte) return null;
  return (
    <MessageBubble
      data={{
        id: message.id,
        direction: "outgoing",
        actor: "user",
        content: texte,
      }}
    />
  );
}

/** Une erreur dans le fil (M10.15) : une phrase de Relvo, et le geste qui va avec. */
function BlocErreur({
  message,
  onRetry,
}: {
  message: string | undefined;
  onRetry: () => void;
}) {
  const e = phraseErreur(message);
  return (
    <RelvoBlock className="pb-2.5" label="Relvo n’a pas pu répondre">
      <RelvoSentence>{e.phrase}</RelvoSentence>
      {e.lien ? (
        <Link href={e.lien.href} className={RELVO_LINK}>
          → {e.lien.label}
        </Link>
      ) : null}
      {e.reessayer ? (
        <button type="button" onClick={onRetry} className={RELVO_LINK}>
          → Réessayer
        </button>
      ) : null}
    </RelvoBlock>
  );
}

export function RelvoFil({
  messages,
  status,
  error,
  onRetry,
}: {
  messages: RelvoUIMessage[];
  status: "submitted" | "streaming" | "ready" | "error";
  error: Error | undefined;
  onRetry: () => void;
}) {
  const dernier = messages[messages.length - 1];
  const attend =
    status === "submitted" ||
    (status === "streaming" && dernier?.role === "user");
  return (
    <div className="flex flex-col gap-3">
      {messages.map((m) =>
        m.role === "user" ? (
          <TourDirigeant key={m.id} message={m} />
        ) : (
          <TourRelvo key={m.id} message={m} />
        ),
      )}
      {attend ? (
        <RelvoBlock className="pb-2.5" label="Relvo réfléchit">
          <RelvoSentence className="text-gris">
            Je regarde
            <Respire className="ml-1" />
          </RelvoSentence>
        </RelvoBlock>
      ) : null}
      {status === "error" ? (
        <BlocErreur message={error?.message} onRetry={onRetry} />
      ) : null}
    </div>
  );
}

/** « 19 oct. » depuis un horodatage français « AAAA-MM-JJ HH:MM » (PITFALLS #55), sans parser d'instant. */
function jourCourt(horodatage: string): string {
  return new Date(`${horodatage.slice(0, 10)}T12:00:00Z`).toLocaleDateString(
    "fr-FR",
    { day: "numeric", month: "short", timeZone: "UTC" },
  );
}
