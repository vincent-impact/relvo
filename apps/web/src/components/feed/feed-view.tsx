"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { FeedDomainBar } from "@/components/feed/feed-domain-bar";
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
import { ZoneHeading } from "@/components/shared/zone-heading";

// Vue complète de Sujets (client) — la carte KPI est une BARRE D'ONGLETS chiffrée
// par STATUT (Ouverts · Validés · Fermés), et la barre de filtres ne propose que
// les DOMAINES (chips icône + couleur, défilables). Tout est instantané côté
// client sur les lignes déjà chargées.
//
// Onglets = un seul axe, le statut (2026-07-24) : « Urgents » et « Nouveaux » ont
// été retirés (marqueurs, pas des états — déjà distingués dans la liste des
// Ouverts). Validés et Fermés sont les deux familles terminales récupérables
// (Fermés = soft delete, réouvrable).

type Tagged = { row: SubjectRowData; basket: "ouvert" | "done" };

const TAB_LABEL: Record<SubjectTab, string> = {
  ouverts: "Ouvertes",
  valides: "Validées",
  fermes: "Fermées",
};

// L'état vide GUIDE : c'est dans un onglet vide qu'on apprend le geste. Les
// ouverts, eux, sont dans la voix de Relvo (ci-dessous) : c'est lui qui les
// remplit, et c'est lui qui dit par où commencer quand rien n'est arrivé.
const EMPTY: Record<SubjectTab, string> = {
  ouverts: "Aucune affaire ouverte.",
  valides:
    "Aucune affaire validée. Glissez une affaire ouverte vers la droite pour la valider.",
  fermes:
    "Aucune affaire fermée. Glissez une affaire vers la gauche pour la fermer.",
};

// Onglet initial déduit de l'URL. `?urgent=1` / `?nouveau=1` (anciens liens)
// retombent sur « Ouverts » : ces sujets y vivent, distingués visuellement.
function initialTab(params: URLSearchParams): SubjectTab {
  if (params.get("statut") === "valide") return "valides";
  if (params.get("statut") === "ferme") return "fermes";
  return "ouverts";
}

export function FeedView({
  ouverts,
  valides,
  fermes,
  folders,
  hasChannels = true,
}: {
  ouverts: SubjectRowData[];
  valides: SubjectRowData[];
  fermes: SubjectRowData[];
  folders: FolderChip[];
  /** Aucune boîte reliée : l'état vide mène à Canaux. */
  hasChannels?: boolean;
}) {
  const params = useSearchParams();
  const [tab, setTab] = useState<SubjectTab>(() => initialTab(params));
  // Le dossier filtré, par identifiant : un dossier et tout ce qu'il contient.
  const [domain, setDomain] = useState<string | null>(
    params.get("dossier") || null,
  );

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

  const filtered = base.filter(
    ({ row }) => domain == null || (row.folderChainIds ?? []).includes(domain),
  );
  // Les dossiers qui ont au moins un sujet dans l'onglet — eux ou un de leurs
  // fils : seuls ceux-là ont une puce (une puce vers une liste vide est une
  // puce morte).
  const present = useMemo(
    () => new Set(base.flatMap(({ row }) => row.folderChainIds ?? [])),
    [base],
  );
  const domainName =
    domain == null
      ? null
      : (folders.find((f) => f.id === domain)?.path ?? null);

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

      <FeedDomainBar
        domain={domain}
        onDomain={setDomain}
        folders={folders}
        present={present}
      />

      {/* Sans filtre, l'indicateur cerclé nomme déjà la zone et la compte : un
          en-tête « Ouverts · 25 sujets » le redisait soixante pixels plus bas.
          Sous filtre, l'en-tête dit ce que le filtre a retenu. */}
      {domainName != null ? (
        <div className="pt-3">
          <ZoneHeading
            label={domainName}
            hint={`${filtered.length} sur ${base.length}`}
          />
        </div>
      ) : (
        <div className="pt-3" />
      )}

      {filtered.length === 0 && domainName == null && tab === "ouverts" ? (
        // Rien d'ouvert : Relvo dit ce qu'il fera, et par où commencer. Le
        // « + » reste la porte de l'utilisateur, le bloc ne l'enferme pas.
        <RelvoBlock className="mx-4">
          <RelvoSentence>
            {hasChannels
              ? "Je n’ai pas encore ouvert d’affaire. Dès que je lis votre courrier, chaque affaire — un devis, une relance, un litige — apparaît ici. Vous pouvez aussi en ouvrir une vous-même avec le +."
              : "Je n’ai encore rien à lire. Reliez la boîte où arrivent vos fournisseurs et vos clients : je lis le courrier des dernières semaines et j’ouvre ici vos premières affaires."}
          </RelvoSentence>
          {!hasChannels ? (
            <Link href="/canaux" className={RELVO_LINK}>
              → Relier ma boîte e-mail
            </Link>
          ) : null}
        </RelvoBlock>
      ) : filtered.length === 0 ? (
        <p className="px-[22px] py-10 text-center text-[14px] font-light text-gris">
          {domainName != null
            ? `Aucune affaire « ${domainName} » parmi les ${TAB_LABEL[tab].toLowerCase()}.`
            : EMPTY[tab]}
        </p>
      ) : (
        <ListPanel>{filtered.map(renderRow)}</ListPanel>
      )}
    </>
  );
}
