"use client";

import Link from "next/link";
import { getToolName, isToolUIPart, type UIMessagePart } from "ai";
import {
  RelvoBlock,
  RelvoSentence,
  RELVO_LINK,
} from "@/components/shared/relvo-block";
import { MessageBubble } from "@/components/shared/message-bubble";
import {
  SubjectRow,
  type SubjectRowData,
} from "@/components/shared/subject-row";
import { TaskItem, type TaskItemData } from "@/components/subject/task-item";
import type {
  OutilsRelvoUI,
  RelvoUIMessage,
  SortieOutil,
} from "@/server/ia/echange/outils";
import { cn } from "@/lib/utils";

// Le FIL de l'échange avec Relvo (M10.9, M10.14) — ce que le dirigeant lit.
//
// Un tour du dirigeant est la bulle sortante des conversations ; un tour de
// Relvo est UN bloc de Relvo, dans lequel le texte arrive en flux et où chaque
// outil appelé se rend en BLOC : d'abord « je regarde… », puis le résultat avec
// les composants des écrans — une affaire est une ligne d'affaire, une tâche
// une ligne de tâche (01 §11 « Relvo rend les mêmes composants que
// l'interface », invariant 31). Jamais une liste à puces pour ce que le produit
// sait rendre. Une action faite est une phrase signée ✦ avec [Voir] et
// [Annuler] (05 §11.6) ; l'annulation se branche en tranche 2.
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
  create_task: "Je crée la tâche",
};

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
    case "tache-creee": {
      const t = sortie.tache;
      const voir = t.subjectId ? `/sujets/${t.subjectId}` : "/calendrier";
      return (
        <>
          <RelvoSentence>
            ✦ J’ai créé la tâche{" "}
            <span className="font-medium">« {t.title} »</span>
            {t.subjectTitle ? ` dans ${t.subjectTitle}` : ""}.
          </RelvoSentence>
          <Taches taches={[t]} />
          <div className="mt-1 flex items-center gap-4">
            <Link href={voir} className={cn(RELVO_LINK, "py-1")}>
              → Voir
            </Link>
            <button
              type="button"
              disabled
              title="Bientôt"
              className="py-1 text-[14px] font-medium text-gris opacity-60"
            >
              Annuler
            </button>
          </div>
        </>
      );
    }
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
  if (visibles.length === 0) return null;
  return (
    <RelvoBlock className="pb-2.5">
      {visibles.map((p, i) =>
        p.type === "text" ? (
          <TexteRelvo key={i} texte={p.text} />
        ) : (
          <BlocOutil key={i} part={p} />
        ),
      )}
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
        <RelvoBlock className="pb-2.5" label="Relvo n’a pas pu répondre">
          <RelvoSentence>
            {error?.message?.trim() ||
              "Je n’ai pas pu répondre. Réessayez dans un instant."}
          </RelvoSentence>
          <button type="button" onClick={onRetry} className={RELVO_LINK}>
            → Réessayer
          </button>
        </RelvoBlock>
      ) : null}
    </div>
  );
}
