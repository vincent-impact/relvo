"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { PencilSimple, User } from "@/components/shared/picto";
import { toast } from "sonner";
import type { Priority } from "@relvo/db";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ActorPill } from "@/components/shared/actor-pill";
import { ListPanel } from "@/components/shared/list-panel";
import { ZoneHeading } from "@/components/shared/zone-heading";
import { AddTask } from "@/components/subject/add-task";
import { ResolutionBanner } from "@/components/subject/resolution-banner";
import { TaskItem } from "@/components/subject/task-item";
import type { TaskItemData } from "@/lib/task-item-data";
import {
  setSubjectPriorityAction,
  updateSubjectAction,
} from "@/server/actions/subjects";
import { cn } from "@/lib/utils";

// Onglet « Informations » de la fiche Sujet (refonte 2026-07-28 : moins
// « technique », plus « fiche » ; réordonné 2026-09-15 sur les premiers essais
// réels de la structuration). Ordre FIXE :
//   1. Le CONTEXTE, en UNE ligne de puces compactes (retour du 2026-09-16 : des
//      cartes empilées faisaient un patchwork sans hiérarchie) : le domaine
//      (tap → sélecteur), avec qui on dialogue (tap → fiche du contact), l'urgence
//      (tap → bascule). Du contexte, pas l'information principale : petit.
//   2. La DESCRIPTION — UN panneau blanc, comme les tâches, sinon le texte
//      flotte sur la pierre (retour du second essai réel, 2026-09-16). Trois
//      sous-parties, nommées, séparées d'un filet, qui se lisent comme les
//      lignes d'une même fiche :
//        · Résumé — court : le descriptif de l'utilisateur s'il l'a écrit,
//          sinon celui que Relvo a rédigé, signalé par sa pastille dans le titre
//          du panneau. Un crayon discret sur la ligne ouvre la POP-UP d'édition
//          pré-remplie ; ce que l'utilisateur enregistre devient SON descriptif
//          et l'emporte. (Le bouton « Modifier » en tête de panneau a été retiré :
//          il ne modifiait que le résumé, pas la description, et n'appelait pas.)
//        · Où on en est — la situation que Relvo tient à jour à chaque relecture.
//        · Prochaine étape — UNE ligne, jamais deux : ce qui doit se passer
//          ensuite. Quand rien ne revient au dirigeant et qu'on attend un tiers,
//          la ligne le dit (« En attente : … ») ; l'échéance s'y accroche.
//   3. Les TÂCHES, juste dessous, avec leur progression dans le titre de la
//      section : ce sont elles qui disent la suite. Elles se lisent comme un
//      FIL, la plus récente en tête (échéance, sinon date de création).
// Le journal a son propre onglet, le dernier.
// HIÉRARCHIE UNIQUE : chaque section porte le MÊME libellé en petites capitales
// sourdes au-dessus de son panneau (Description comme Tâches), et tous les
// panneaux s'alignent sur la même gouttière — la page n'a qu'une marge, celle du
// conteneur, aucun panneau n'ajoute la sienne.
// Le « Rapport d'activité de Relvo » (placeholder) est retiré tant qu'il n'a
// rien à montrer. ⚠️ La fiche ne porte AUCUNE action de statut (2026-09-07) :
// valider / fermer / remettre / supprimer vivent tous dans les SWIPES de la page
// Sujets. Le dock de la fiche doublonnait ces gestes et déroutait les testeurs.

export type PaneFolder = {
  id: string;
  name: string;
  slug: string | null;
  color: string | null;
  icon: string | null;
};
/** Un contact du sujet, vers sa fiche. */
export type PaneContact = { id: string; name: string; company: string | null };
/** Ce que Relvo a rédigé à la structuration (05 §1.6). */
export type PaneRelvo = {
  /** Résumé court de Relvo — affiché quand l'utilisateur n'a pas écrit le sien. */
  summary: string | null;
  /** La situation structurée, tenue à chaque relecture (05 §1.6). */
  situation: {
    where: string | null;
    nextStep: string | null;
    waitingFor: string | null;
    /** AAAA-MM-JJ. */
    deadline: string | null;
  } | null;
};

/** Une échéance AAAA-MM-JJ, lisible : « jeu. 17 sept. ». */
function jourLisible(iso: string): string {
  const d = new Date(`${iso}T12:00:00Z`);
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleDateString("fr-FR", {
        weekday: "short",
        day: "numeric",
        month: "short",
      });
}

export function InformationsPane({
  subjectId,
  description,
  folders,
  folderId,
  priority,
  relvo = null,
  contacts = [],
  tasks,
  subjectTitle,
  reference,
  resolutionSuggested = false,
}: {
  subjectId: string;
  description: string | null;
  folders: PaneFolder[];
  folderId: string | null;
  priority: Priority;
  relvo?: PaneRelvo | null;
  /** Avec qui on dialogue — les contacts du sujet. */
  contacts?: PaneContact[];
  /** Les tâches du sujet, la plus récente en tête — la page principale les porte. */
  tasks: TaskItemData[];
  subjectTitle: string;
  /** Référence du sujet — le bandeau de résolution la nomme. */
  reference: string;
  /** Relvo pense que le sujet est réglé → bandeau de résolution. */
  resolutionSuggested?: boolean;
}) {
  const router = useRouter();
  const [value, setValue] = useState(description ?? "");
  const [editOpen, setEditOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const base = (description ?? "").trim();
  // Le résumé affiché : celui de l'utilisateur, sinon celui de Relvo.
  const relvoSummary = (relvo?.summary ?? "").trim();
  const shown = base || relvoSummary;
  const byRelvo = !base && Boolean(relvoSummary);
  const folder = folders.find((f) => f.id === folderId) ?? null;
  const taskTotal = tasks.length;
  const taskDone = tasks.filter((t) => t.status === "done").length;
  // La situation de Relvo, en deux lignes nommées. La prochaine étape est UNE
  // ligne : l'action qui vient, ou — quand rien ne revient au dirigeant — ce
  // qu'on attend, nommé ; l'échéance s'accroche à cette ligne.
  // Quand Relvo propose de clore, la prochaine étape N'EST PLUS ce que la
  // situation disait — la dernière tâche cochée l'a rendue caduque sans
  // qu'un appel la réécrive (04 §10).
  const sit = relvo?.situation;
  const prochaine = sit
    ? resolutionSuggested
      ? "Plus rien à faire."
      : (sit.nextStep ??
        (sit.waitingFor ? `En attente : ${sit.waitingFor}` : null))
    : null;
  const situationLignes: [string, string][] = sit
    ? (
        [
          ["Où on en est", sit.where],
          [
            "Prochaine étape",
            prochaine
              ? `${prochaine}${sit.deadline && !resolutionSuggested ? ` — pour le ${jourLisible(sit.deadline)}` : ""}`
              : null,
          ],
        ] as [string, string | null][]
      ).filter((x): x is [string, string] => Boolean(x[1]))
    : [];
  const situation = situationLignes.length ? situationLignes : null;

  // Ouvre la pop-up d'édition en repartant du texte AFFICHÉ : corriger le
  // résumé de Relvo, c'est le reprendre, pas repartir d'une page blanche.
  function openEditor() {
    setValue(shown);
    setEditOpen(true);
  }

  function saveDescription() {
    const next = value.trim();
    if (next === base || (!base && next === relvoSummary)) {
      setEditOpen(false);
      return;
    }
    startTransition(async () => {
      const res = await updateSubjectAction(subjectId, {
        description: next || null,
      });
      if (res.ok) {
        toast.success("Description enregistrée");
        setEditOpen(false);
        router.refresh();
      } else {
        toast.error(res.message);
      }
    });
  }

  function toggleUrgent(next: boolean) {
    startTransition(async () => {
      const res = await setSubjectPriorityAction(
        subjectId,
        next ? "urgent" : "normal",
      );
      if (res.ok) router.refresh();
      else toast.error(res.message);
    });
  }

  return (
    <div className="space-y-6 px-4 pt-4 pb-2">
      {/* 1. Le contexte : avec qui, et si ça presse. Le domaine vit dans le ciel
          (ligne du dessus, où il se change) : il n'est pas redit ici. */}
      <section className="flex flex-wrap gap-2">
        {contacts.map((c) => (
          <Link
            key={c.id}
            href={`/contacts/${c.id}`}
            className="pressable inline-flex h-9 flex-none items-center gap-1.5 rounded-(--rayon-pilule) border border-(--filet) bg-white pr-3 pl-1.5 text-[13px] font-medium text-noir shadow-carte"
          >
            <span className="grid size-6 flex-none place-items-center rounded-full bg-(--fond-puce) text-gris">
              <User className="size-[13px]" />
            </span>
            <span className="max-w-[60vw] truncate">
              {c.name}
              {/* L'entreprise seulement si elle ajoute quelque chose au nom. */}
              {c.company && c.company.trim() !== c.name.trim() ? (
                <span className="font-normal text-gris"> · {c.company}</span>
              ) : null}
            </span>
          </Link>
        ))}
        {/* Urgent se lit à la FORME (01-tokens) : une pastille pleine rouge sur
            une puce blanche quand c'est le cas ; éteint, l'interrupteur est
            fantôme, en pointillé — il se lirait sinon comme une information. */}
        <button
          type="button"
          role="switch"
          aria-checked={priority === "urgent"}
          disabled={pending}
          onClick={() => toggleUrgent(priority !== "urgent")}
          className={cn(
            "pressable inline-flex h-9 flex-none items-center gap-1.5 rounded-(--rayon-pilule) border px-3 text-[12px] font-medium tracking-[0.06em] uppercase",
            priority === "urgent"
              ? "border-(--filet) bg-white text-urgent shadow-carte"
              : "border-dashed border-(--gris-clair) bg-transparent text-gris",
          )}
        >
          <i
            aria-hidden
            className={cn(
              "size-2 rounded-full",
              priority === "urgent"
                ? "bg-urgent"
                : "border-2 border-(--gris-clair)",
            )}
          />
          Urgent
        </button>
      </section>

      {/* 2. Résumé — un PANNEAU, comme les tâches : c'est la surface qui
          dit où la fiche commence et finit. Dedans, trois lignes nommées
          (Description, Où on en est, Prochaine étape) séparées d'un filet, en
          sous-titres plus petits que le libellé du panneau : on lit qu'elles
          sont des parties du résumé, pas des sections de la page (libellés
          intervertis à la demande du dirigeant, 2026-09-18). Le mot « Résumé »
          ne disparaît jamais :
            • Relvo a rédigé → sa pastille d'acteur à côté du libellé
            • l'utilisateur a écrit → le libellé seul (sa version l'emporte)
            • vide (sujet créé à la main) → dans le panneau, une INVITE dans le
              vocabulaire d'« Ajouter une tâche ». */}
      <section>
        <SectionHead
          title="Résumé"
          badge={byRelvo ? <ActorPill actor="ai" /> : null}
        />
        {shown || situation ? (
          <ListPanel className="mx-0 divide-y divide-(--border-light) px-4">
            <DescriptionLine
              label="Description"
              action={
                <button
                  type="button"
                  onClick={openEditor}
                  aria-label="Modifier la description"
                  className="grid size-6 place-items-center rounded-full text-(--text-tertiary) active:bg-(--surface-2)"
                >
                  <PencilSimple className="size-[13px]" />
                </button>
              }
            >
              {shown ? (
                <span className="whitespace-pre-wrap">{shown}</span>
              ) : (
                <button
                  type="button"
                  onClick={openEditor}
                  className="text-[14px] font-medium text-relvo active:opacity-70"
                >
                  Résumer ce sujet en une phrase
                </button>
              )}
            </DescriptionLine>
            {situation?.map(([label, value]) => (
              <DescriptionLine key={label} label={label}>
                {value}
              </DescriptionLine>
            ))}
          </ListPanel>
        ) : (
          // Même dessin d'invite que « Ajouter une tâche » : un seul sur la fiche.
          <button
            type="button"
            onClick={openEditor}
            className="flex items-center gap-2.5 px-1 py-1 text-[14px] font-medium text-relvo active:opacity-70"
          >
            <span className="grid size-6 flex-none place-items-center rounded-full bg-relvo-bg">
              <Plus className="size-[15px]" strokeWidth={2.6} />
            </span>
            Résumer ce sujet en une phrase
          </button>
        )}
      </section>

      {/* 2 bis. Ce que Relvo conclut — RARE, donc fort (cf. ResolutionBanner). */}
      {resolutionSuggested ? (
        <ResolutionBanner subjectId={subjectId} reference={reference} />
      ) : null}

      {/* 3. Tâches — sur la page principale : le sujet, c'est ce qu'il reste à faire */}
      <section>
        <SectionHead
          title="Tâches"
          // Le compte seul, en condensé, comme sur la ligne de la liste : une
          // icône et une jauge disaient trois fois 0/3.
          right={
            taskTotal > 0 ? (
              <span className="chiffre text-[16px] leading-5 text-noir">
                {taskDone}/{taskTotal}
              </span>
            ) : null
          }
        />
        {tasks.length === 0 ? (
          <p className="px-1 text-[14px] font-light text-gris">Aucune tâche.</p>
        ) : (
          <ListPanel className="mx-0">
            {tasks.map((t) => (
              <TaskItem key={t.id} meta="date" task={t} />
            ))}
          </ListPanel>
        )}
        <AddTask
          subjectId={subjectId}
          subjectTitle={subjectTitle}
          subjectFolderSlug={folder?.slug ?? null}
        />
      </section>

      {/* Édition du résumé — pop-up dédiée (jamais dans le flux de la fiche) */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="gap-4 p-5">
          <DialogHeader>
            <DialogTitle>Description du sujet</DialogTitle>
          </DialogHeader>
          <textarea
            value={value}
            onChange={(e) => setValue(e.target.value)}
            rows={4}
            autoFocus
            placeholder="Résumez ce sujet en une phrase ou deux…"
            className="w-full resize-y rounded-xl border border-(--border) bg-white px-3 py-2.5 text-[14px] leading-[1.5] text-(--text-primary) outline-none placeholder:text-(--text-tertiary) focus:border-brand"
          />
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setEditOpen(false)}
              disabled={pending}
              className="rounded-full px-3.5 py-1.5 text-[13px] font-semibold text-(--text-secondary) active:bg-(--surface-2)"
            >
              Annuler
            </button>
            <button
              type="button"
              onClick={saveDescription}
              disabled={pending}
              className="rounded-full bg-relvo px-4 py-1.5 text-[13px] font-bold text-white active:opacity-90 disabled:opacity-60"
            >
              Enregistrer
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/** Une ligne de la description : un sous-titre sourd, plus petit que le libellé du panneau, puis le texte. */
function DescriptionLine({
  label,
  action = null,
  children,
}: {
  label: string;
  /** Un geste discret à droite du sous-titre (le crayon du résumé). */
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="py-3 first:pt-3.5 last:pb-3.5">
      <div className="mb-1 flex min-h-6 items-center justify-between gap-2">
        <span className="libelle">{label}</span>
        {action}
      </div>
      <div className="text-[14.5px] leading-[1.5] text-(--text-primary)">
        {children}
      </div>
    </div>
  );
}

/**
 * En-tête de zone de la fiche — le MÊME pour « Résumé » et « Tâches », et le
 * même que sur toutes les pages : `ZoneHeading`, en texte nu (02-composants,
 * « toute zone est nommée, et les en-têtes sont symétriques »). Le libellé à
 * gauche avec qui parle, ce qui qualifie la zone à droite (la progression des
 * tâches). La fiche impose sa propre gouttière.
 */
function SectionHead({
  title,
  badge = null,
  right = null,
}: {
  title: string;
  /** Qui parle — la pastille d'acteur, quand le contenu n'est pas de l'utilisateur. */
  badge?: React.ReactNode;
  right?: React.ReactNode;
}) {
  return (
    <ZoneHeading label={title} badge={badge} hint={right} className="px-1" />
  );
}
