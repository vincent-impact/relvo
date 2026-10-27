"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  RangerDansSheet,
  type DossierChoix,
} from "@/components/memoire/ranger-dans-sheet";
import { Folder } from "@/components/shared/picto";
import {
  SubjectRow,
  type SubjectRowData,
} from "@/components/shared/subject-row";
import { SwipeRow } from "@/components/shared/swipe-row";
import { updateSubjectAction } from "@/server/actions/subjects";

// Les sujets d'un dossier, RANGEABLES d'un glissement (M27.4) : la ligne
// glissée vers la droite révèle « Ranger » (le fond du geste de l'utilisateur,
// jamais le violet de Relvo), on lâche, la ligne revient et la feuille « Ranger
// dans… » s'ouvre. Un tap sur la ligne ouvre la fiche. Le geste s'annule depuis
// le toast. Sur la page Sujets, les gestes restent ceux d'aujourd'hui (à
// droite valider, à gauche fermer) : un même geste ne dit pas deux choses sur
// la même page.

export function SujetsRangeables({
  rows,
  dossiers,
}: {
  rows: SubjectRowData[];
  dossiers: DossierChoix[];
}) {
  const router = useRouter();
  const [cible, setCible] = useState<SubjectRowData | null>(null);
  const [, startTransition] = useTransition();

  function ranger(sujet: SubjectRowData, folderId: string | null) {
    const precedent = sujet.folderChainIds?.at(-1) ?? null;
    if (folderId === precedent) return;
    const nom =
      folderId == null
        ? "sans dossier"
        : `dans ${dossiers.find((d) => d.id === folderId)?.path ?? "ce dossier"}`;
    startTransition(async () => {
      const res = await updateSubjectAction(sujet.id, { folderId });
      if (!res.ok) {
        toast.error(res.message);
        return;
      }
      router.refresh();
      toast.success(`« ${sujet.title} » rangé ${nom}`, {
        duration: 8000,
        action: {
          label: "Annuler",
          onClick: () => {
            startTransition(async () => {
              const back = await updateSubjectAction(sujet.id, {
                folderId: precedent,
              });
              if (back.ok) {
                toast.success("Remis où il était");
                router.refresh();
              } else toast.error(back.message);
            });
          },
        },
      });
    });
  }

  return (
    <>
      {rows.map((row) => (
        <SwipeRow
          key={row.id}
          onTap={() => router.push(`/sujets/${row.id}`)}
          right={{
            label: "Ranger",
            icon: Folder,
            tone: "brand",
            keepOnAct: true,
            onAct: () => setCible(row),
          }}
        >
          <SubjectRow data={row} linkable={false} />
        </SwipeRow>
      ))}
      <RangerDansSheet
        open={cible != null}
        onOpenChange={(o) => !o && setCible(null)}
        sousTitre={
          cible
            ? `${cible.title} · aujourd’hui ${cible.folderPath ? `dans ${cible.folderPath}` : "sans dossier"}`
            : undefined
        }
        dossiers={dossiers}
        actuel={cible?.folderChainIds?.at(-1) ?? null}
        racine="grisee"
        sansDossier
        onChoix={(id) => cible && ranger(cible, id)}
      />
    </>
  );
}
