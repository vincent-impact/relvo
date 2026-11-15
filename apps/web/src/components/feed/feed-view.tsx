"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { SujetsArbre } from "@/components/feed/sujets-arbre";
import {
  SubjectKpiTabs,
  type SubjectTab,
} from "@/components/feed/subject-kpi-tabs";
import { SwipeableSubject } from "@/components/feed/swipeable-subject";
import { SwipeableDoneSubject } from "@/components/feed/swipeable-done-subject";
import {
  SubjectRow,
  type SubjectRowData,
} from "@/components/shared/subject-row";
import type { FolderChip } from "@/server/cached";
import { ListPanel } from "@/components/shared/list-panel";
import {
  RELVO_LINK,
  RelvoBlock,
  RelvoSentence,
} from "@/components/shared/relvo-block";

// La page Sujets (client) — UNE page, DEUX VUES (M28.1) sur la même matière :
// « Sujets », la liste à plat ; « Dossiers », l'arbre complet (`SujetsArbre`).
// Dans les deux, un sujet se valide ou se ferme d'un balayage. La carte KPI est
// une BARRE D'ONGLETS chiffrée par STATUT (Ouverts · Validés · Fermés) qui
// agit sur les deux vues de la même façon. Tout est instantané côté client
// sur les lignes déjà chargées — toutes : rien n'est coupé.
//
// Onglets = un seul axe, le statut (2026-07-24) : « Urgents » et « Nouveaux » ont
// été retirés (marqueurs, pas des états — déjà distingués dans la liste des
// Ouverts). Validés et Fermés sont les deux familles terminales récupérables
// (Fermés = soft delete, réouvrable).

type Tagged = { row: SubjectRowData; basket: "ouvert" | "done" };

// L'état vide GUIDE : c'est dans un onglet vide qu'on apprend le geste. Les
// ouverts, eux, sont dans la voix de Relvo (ci-dessous) : c'est lui qui les
// remplit, et c'est lui qui dit par où commencer quand rien n'est arrivé.
const EMPTY: Record<SubjectTab, string> = {
  ouverts: "Aucun sujet ouvert.",
  valides:
    "Aucun sujet validé. Glissez un sujet ouvert vers la droite pour le valider.",
  fermes: "Aucun sujet fermé. Glissez un sujet vers la gauche pour le fermer.",
};

// Onglet initial déduit de l'URL. `?urgent=1` / `?nouveau=1` (anciens liens)
// retombent sur « Ouverts » : ces sujets y vivent, distingués visuellement.
function initialTab(params: URLSearchParams): SubjectTab {
  if (params.get("statut") === "valide") return "valides";
  if (params.get("statut") === "ferme") return "fermes";
  return "ouverts";
}

export type VueSujets = "sujets" | "dossiers";

export function FeedView({
  vue,
  ouverts,
  valides,
  fermes,
  folders,
  profondeurMax,
  hasChannels = true,
}: {
  /** La vue choisie dans le ciel : la liste à plat, ou l'arbre. */
  vue: VueSujets;
  ouverts: SubjectRowData[];
  valides: SubjectRowData[];
  fermes: SubjectRowData[];
  folders: FolderChip[];
  /** La profondeur bornée de l'arbre des dossiers (domaine). */
  profondeurMax: number;
  /** Aucune boîte reliée : l'état vide mène à Canaux. */
  hasChannels?: boolean;
}) {
  const params = useSearchParams();
  const [tab, setTab] = useState<SubjectTab>(() => initialTab(params));
  const counts: Record<SubjectTab, number> = useMemo(
    () => ({
      ouverts: ouverts.length,
      valides: valides.length,
      fermes: fermes.length,
    }),
    [ouverts, valides, fermes],
  );

  // Liste de base selon l'onglet, chaque ligne taguée par panier (rendu adapté).
  const base: Tagged[] = useMemo(() => {
    if (tab === "valides")
      return valides.map((row) => ({ row, basket: "done" as const }));
    if (tab === "fermes")
      return fermes.map((row) => ({ row, basket: "done" as const }));
    return ouverts.map((row) => ({ row, basket: "ouvert" as const }));
  }, [tab, ouverts, valides, fermes]);

  function renderRow({ row, basket }: Tagged) {
    if (basket === "ouvert") {
      return (
        <SwipeableSubject
          key={row.id}
          subjectId={row.id}
          canClose
          openTasks={Math.max(row.taskTotal - row.taskDone, 0)}
        >
          <SubjectRow data={row} linkable={false} />
        </SwipeableSubject>
      );
    }
    // Terminal (validé / fermé) : ← Supprimer · → Remettre. C'est désormais le
    // SEUL chemin de réouverture — les boutons de la fiche Sujet ont été retirés.
    return (
      <SwipeableDoneSubject key={row.id} subjectId={row.id}>
        <SubjectRow data={row} tone="done" linkable={false} />
      </SwipeableDoneSubject>
    );
  }

  return (
    <>
      <SubjectKpiTabs active={tab} onChange={setTab} counts={counts} />

      <div className="pt-3" />

      {base.length === 0 &&
      tab === "ouverts" &&
      (vue === "sujets" || folders.length === 0) ? (
        // Rien d'ouvert : Relvo dit ce qu'il fera, et par où commencer. Le
        // « + » reste la porte de l'utilisateur, le bloc ne l'enferme pas.
        <RelvoBlock className="mx-4">
          <RelvoSentence>
            {hasChannels
              ? "Je n’ai pas encore ouvert de sujet. Dès que je lis votre courrier, chaque sujet — un devis, une relance, un litige — apparaît ici. Vous pouvez aussi en ouvrir une vous-même avec le +."
              : "Je n’ai encore rien à lire. Reliez la boîte où arrivent vos fournisseurs et vos clients : je lis le courrier des dernières semaines et j’ouvre ici vos premiers sujets."}
          </RelvoSentence>
          {!hasChannels ? (
            <Link href="/canaux" className={RELVO_LINK}>
              → Relier ma boîte e-mail
            </Link>
          ) : null}
        </RelvoBlock>
      ) : null}

      {base.length === 0 && tab !== "ouverts" ? (
        <p className="px-[22px] py-10 text-center text-[14px] font-light text-gris">
          {EMPTY[tab]}
        </p>
      ) : null}

      {vue === "dossiers" ? (
        // L'arbre reste monté même vide : c'est lui qui porte « Nouveau
        // dossier » et la feuille de création que le « + » du ciel ouvre.
        <div className={base.length === 0 ? "pt-3" : undefined}>
          <SujetsArbre
            folders={folders}
            rows={base.map(({ row }) => row)}
            ouverts={tab === "ouverts"}
            profondeurMax={profondeurMax}
          />
        </div>
      ) : base.length > 0 ? (
        <ListPanel>{base.map(renderRow)}</ListPanel>
      ) : null}
    </>
  );
}
