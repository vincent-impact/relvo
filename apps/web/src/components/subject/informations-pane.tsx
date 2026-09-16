"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ChevronDown,
  Flag,
  Pencil,
  Plus,
  SquareCheck,
  UserRound,
} from "lucide-react";
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
import { AddTask } from "@/components/subject/add-task";
import { ResolutionBanner } from "@/components/subject/resolution-banner";
import { TaskItem } from "@/components/subject/task-item";
import type { TaskItemData } from "@/lib/task-item-data";
import {
  setSubjectPriorityAction,
  updateSubjectAction,
} from "@/server/actions/subjects";
import { folderVisual } from "@/lib/folders";
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
  const [pickerOpen, setPickerOpen] = useState(false);

  const base = (description ?? "").trim();
  // Le résumé affiché : celui de l'utilisateur, sinon celui de Relvo.
  const relvoSummary = (relvo?.summary ?? "").trim();
  const shown = base || relvoSummary;
  const byRelvo = !base && Boolean(relvoSummary);
  const folder = folders.find((f) => f.id === folderId) ?? null;
  const folderViz = folderVisual(
    folder
      ? { slug: folder.slug, color: folder.color, icon: folder.icon }
      : "general",
  );
  const FolderIcon = folderViz.icon;
  const taskTotal = tasks.length;
  const taskDone = tasks.filter((t) => t.status === "done").length;
  // La situation de Relvo, en deux lignes nommées. La prochaine étape est UNE
  // ligne : l'action qui vient, ou — quand rien ne revient au dirigeant — ce
  // qu'on attend, nommé ; l'échéance s'accroche à cette ligne.
  const sit = relvo?.situation;
  const prochaine = sit
    ? (sit.nextStep ??
      (sit.waitingFor ? `En attente : ${sit.waitingFor}` : null))
    : null;
  const situationLignes: [string, string][] = sit
    ? (
        [
          ["Où on en est", sit.where],
          [
            "Prochaine étape",
            prochaine
              ? `${prochaine}${sit.deadline ? ` — pour le ${jourLisible(sit.deadline)}` : ""}`
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
        toast.success("Résumé enregistré");
        setEditOpen(false);
        router.refresh();
      } else {
        toast.error(res.message);
      }
    });
  }

  function setFolder(nextId: string | null) {
    setPickerOpen(false);
    startTransition(async () => {
      const res = await updateSubjectAction(subjectId, { folderId: nextId });
      if (res.ok) {
        toast.success("Domaine mis à jour");
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
      {/* 1. Le contexte : une ligne de puces, qui passe à deux rangées si les noms sont longs */}
      <section className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setPickerOpen(true)}
          className="pressable inline-flex h-7 flex-none items-center gap-1.5 rounded-full border border-(--hairline) bg-white pr-2 pl-1 text-[12.5px] font-semibold text-(--text-primary) shadow-surface-1"
        >
          <span
            className="grid size-5 flex-none place-items-center rounded-full text-white"
            style={{ background: folderViz.color }}
          >
            <FolderIcon className="size-[12px]" strokeWidth={2.2} />
          </span>
          <span className="max-w-[44vw] truncate">
            {folder?.name ?? "Non classé"}
          </span>
          <ChevronDown
            className="size-3.5 flex-none text-(--text-tertiary)"
            strokeWidth={2.4}
          />
        </button>
        {contacts.map((c) => (
          <Link
            key={c.id}
            href={`/contacts/${c.id}`}
            className="pressable inline-flex h-7 flex-none items-center gap-1.5 rounded-full border border-(--hairline) bg-white pr-2.5 pl-1 text-[12.5px] font-semibold text-(--text-primary) shadow-surface-1"
          >
            <span className="grid size-5 flex-none place-items-center rounded-full bg-(--surface-2) text-(--text-secondary)">
              <UserRound className="size-[12px]" strokeWidth={2.2} />
            </span>
            <span className="max-w-[60vw] truncate">
              {c.name}
              {/* L'entreprise seulement si elle ajoute quelque chose au nom. */}
              {c.company && c.company.trim() !== c.name.trim() ? (
                <span className="font-normal text-(--text-secondary)">
                  {" "}
                  · {c.company}
                </span>
              ) : null}
            </span>
          </Link>
        ))}
        <button
          type="button"
          role="switch"
          aria-checked={priority === "urgent"}
          disabled={pending}
          onClick={() => toggleUrgent(priority !== "urgent")}
          className={cn(
            // Éteint, il est FANTÔME : posé comme les deux autres puces, il se
            // lirait comme une information alors que c'est un interrupteur.
            "pressable inline-flex h-7 flex-none items-center gap-1.5 rounded-full border px-2.5 text-[12.5px] font-semibold",
            priority === "urgent"
              ? "border-transparent bg-(--red-600) text-white shadow-surface-1"
              : "border-dashed border-[#d4d2cc] bg-transparent text-(--text-tertiary)",
          )}
        >
          <Flag
            className="size-[13px]"
            strokeWidth={priority === "urgent" ? 0 : 2.2}
            fill={priority === "urgent" ? "currentColor" : "none"}
          />
          Urgent
        </button>
      </section>

      {/* 2. Description — un PANNEAU, comme les tâches : c'est la surface qui
          dit où la fiche commence et finit. Dedans, trois lignes nommées
          (Résumé, Où on en est, Prochaine étape) séparées d'un filet, en
          sous-titres plus petits que le libellé du panneau : on lit qu'elles
          sont des parties de la description, pas des sections de la page. Le
          mot « Description » ne disparaît jamais :
            • Relvo a rédigé → sa pastille d'acteur à côté du libellé
            • l'utilisateur a écrit → le libellé seul (sa version l'emporte)
            • vide (sujet créé à la main) → dans le panneau, une INVITE dans le
              vocabulaire d'« Ajouter une tâche ». */}
      <section>
        <SectionHead
          title="Description"
          badge={byRelvo ? <ActorPill actor="ai" /> : null}
        />
        {shown || situation ? (
          <ListPanel className="mx-0 divide-y divide-(--border-light) px-4">
            <DescriptionLine
              label="Résumé"
              action={
                <button
                  type="button"
                  onClick={openEditor}
                  aria-label="Modifier le résumé"
                  className="grid size-6 place-items-center rounded-full text-(--text-tertiary) active:bg-(--surface-2)"
                >
                  <Pencil className="size-[13px]" strokeWidth={2.2} />
                </button>
              }
            >
              {shown ? (
                <span className="whitespace-pre-wrap">{shown}</span>
              ) : (
                <button
                  type="button"
                  onClick={openEditor}
                  className="text-[14.5px] font-semibold text-relvo active:opacity-70"
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
          <button
            type="button"
            onClick={openEditor}
            className="flex items-center gap-2.5 px-1 active:opacity-70"
          >
            <span className="grid size-[30px] flex-none place-items-center rounded-full bg-relvo-bg text-relvo">
              <Plus className="size-[17px]" strokeWidth={2.4} />
            </span>
            <span className="text-[14.5px] font-semibold text-relvo">
              Résumer ce sujet en une phrase
            </span>
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
          right={
            taskTotal > 0 ? (
              <div className="flex items-center gap-2">
                <SquareCheck
                  className={cn(
                    "size-[15px] flex-none",
                    taskDone >= taskTotal
                      ? "text-(--green-600)"
                      : "text-(--text-tertiary)",
                  )}
                  strokeWidth={2.2}
                />
                <span className="relative block h-1.5 w-16 overflow-hidden rounded-full bg-[#e7e5e0] shadow-[inset_0_1px_1px_rgb(20_18_40/0.08)]">
                  <span
                    className="absolute inset-y-0 left-0 rounded-full bg-(--green-600) transition-[width]"
                    style={{
                      width: `${Math.round((100 * taskDone) / taskTotal)}%`,
                    }}
                  />
                </span>
                <span className="font-numeric text-[11.5px] font-bold text-(--text-secondary)">
                  {taskDone}/{taskTotal}
                </span>
              </div>
            ) : null
          }
        />
        {tasks.length === 0 ? (
          <p className="px-1 text-[13.5px] text-(--text-tertiary)">
            Aucune tâche.
          </p>
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

      {/* Sélecteur de domaine */}
      <Dialog open={pickerOpen} onOpenChange={setPickerOpen}>
        <DialogContent className="gap-4 p-5">
          <DialogHeader>
            <DialogTitle>Domaine du sujet</DialogTitle>
          </DialogHeader>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setFolder(null)}
              className={cn(
                "inline-flex h-9 items-center rounded-full border px-3.5 text-[13px] font-semibold transition-colors",
                folderId == null
                  ? "border-transparent bg-(--text-primary) text-white"
                  : "border-(--border) bg-white text-(--text-secondary)",
              )}
            >
              Non classé
            </button>
            {folders.map((f) => {
              const viz = folderVisual({
                slug: f.slug,
                color: f.color,
                icon: f.icon,
              });
              const active = folderId === f.id;
              const Icon = viz.icon;
              return (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setFolder(f.id)}
                  className={cn(
                    "inline-flex h-9 items-center gap-1.5 rounded-full border px-3.5 text-[13px] font-semibold transition-colors",
                    active
                      ? "border-transparent text-white"
                      : "border-(--border) bg-white text-(--text-secondary)",
                  )}
                  style={
                    active
                      ? { background: viz.color, borderColor: viz.color }
                      : undefined
                  }
                >
                  <Icon
                    className="size-[15px] flex-none"
                    strokeWidth={2.2}
                    style={active ? undefined : { color: viz.color }}
                  />
                  {f.name}
                </button>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>

      {/* Édition du résumé — pop-up dédiée (jamais dans le flux de la fiche) */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="gap-4 p-5">
          <DialogHeader>
            <DialogTitle>Résumé du sujet</DialogTitle>
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
        <span className="text-[10.5px] font-bold tracking-[0.3px] text-(--text-tertiary) uppercase">
          {label}
        </span>
        {action}
      </div>
      <div className="text-[14.5px] leading-[1.5] text-(--text-primary)">
        {children}
      </div>
    </div>
  );
}

/**
 * En-tête de zone de la fiche — le MÊME pour « Description » et « Tâches ».
 *
 * C'est lui qui délimite les zones : sans libellé, un sujet neuf n'est qu'une
 * suite d'éléments flottants dont on ne sait pas à quoi ils servent. Les deux
 * en-têtes sont volontairement symétriques — libellé à gauche, ce qui qualifie
 * la zone à droite (la source du résumé, la progression des tâches) — et c'est
 * la MATIÈRE qui porte la hiérarchie : le résumé se lit à même la pierre, les
 * tâches se manipulent dans un panneau blanc.
 *
 * Il ne réutilise pas `shared/section-label.tsx`, qui porte sa propre gouttière
 * et n'accepte qu'un lien : ici la fiche impose sa marge, et la droite reçoit
 * un contenu libre.
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
    <div className="mb-2 flex min-h-7 items-center justify-between gap-3 px-1">
      <h2 className="flex min-w-0 items-center gap-2 text-[12px] font-bold tracking-[0.4px] text-(--text-tertiary) uppercase">
        {title}
        {badge}
      </h2>
      {right}
    </div>
  );
}
