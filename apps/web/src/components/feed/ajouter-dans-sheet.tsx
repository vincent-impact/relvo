"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { FileTextTrait, FolderTrait } from "@/components/shared/picto";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from "@/components/ui/sheet";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { createFolderAction } from "@/server/actions/folders";
import { createSubjectAction } from "@/server/actions/subjects";

// La feuille « Ajouter dans… » (M28.2, tranchée sur maquette) — ce qu'ouvre la
// dernière ligne d'une branche dépliée de l'arbre, le « + » du ciel et le
// bouton du pied. Elle monte du bas, comme « Ranger dans… » : une bascule Un
// sujet / Un dossier, UN nom, Créer. Rien d'autre : ce qu'un sujet ou un
// dossier portent de plus (contacts, description, couleur) se donne sur leur
// fiche, après. La destination est dite par le titre — on ne la choisit pas
// ici, on y est déjà.

export type DestinationAjout =
  /** Dans un dossier : un sujet, ou un dossier si l'arbre peut encore descendre. */
  | { type: "dossier"; id: string; chemin: string; dossierPossible: boolean }
  /** Hors de tout dossier : un sujet seulement. */
  | { type: "aucun" }
  /** Au premier niveau : un dossier seulement ; `couleur` est la teinte qu'il reçoit. */
  | { type: "racine"; couleur: string };

type Quoi = "sujet" | "dossier";

export function AjouterDansSheet({
  destination,
  onOpenChange,
  onCree,
}: {
  /** Où l'on ajoute ; `null` = feuille fermée. */
  destination: DestinationAjout | null;
  onOpenChange: (open: boolean) => void;
  /** Créé : l'arbre déplie la branche concernée. */
  onCree: () => void;
}) {
  return (
    <Sheet open={destination != null} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        showCloseButton={false}
        className="shadow-feuille rounded-t-(--rayon-feuille) border-t-0 bg-white p-0"
      >
        {destination ? (
          <Formulaire
            // Une destination, un formulaire neuf : le nom ne survit pas d'une
            // branche à l'autre.
            key={JSON.stringify(destination)}
            destination={destination}
            onFerme={() => onOpenChange(false)}
            onCree={onCree}
          />
        ) : null}
      </SheetContent>
    </Sheet>
  );
}

function Formulaire({
  destination,
  onFerme,
  onCree,
}: {
  destination: DestinationAjout;
  onFerme: () => void;
  onCree: () => void;
}) {
  const router = useRouter();
  const sujetPossible = destination.type !== "racine";
  const dossierPossible =
    destination.type === "racine" ||
    (destination.type === "dossier" && destination.dossierPossible);
  const [quoi, setQuoi] = useState<Quoi>(sujetPossible ? "sujet" : "dossier");
  const [nom, setNom] = useState("");
  const [enCours, startTransition] = useTransition();
  const pret = nom.trim().length > 0 && !enCours;

  const titre =
    destination.type === "racine"
      ? "Nouveau dossier"
      : destination.type === "aucun"
        ? "Nouveau sujet sans dossier"
        : `Ajouter dans ${destination.chemin}`;

  function creer(e: React.FormEvent) {
    e.preventDefault();
    if (!pret) return;
    const name = nom.trim();
    startTransition(async () => {
      const res =
        quoi === "sujet"
          ? await createSubjectAction({
              title: name,
              folderId: destination.type === "dossier" ? destination.id : null,
            })
          : await createFolderAction({
              name,
              parentId: destination.type === "dossier" ? destination.id : null,
              ...(destination.type === "racine"
                ? { color: destination.couleur }
                : {}),
            });
      if (!res.ok) {
        toast.error(res.message);
        return;
      }
      onCree();
      onFerme();
      router.refresh();
      toast.success(quoi === "sujet" ? "Sujet créé" : "Dossier créé");
    });
  }

  return (
    <form
      onSubmit={creer}
      className="flex flex-col gap-4 px-4 pt-2 pb-[max(env(safe-area-inset-bottom),20px)]"
    >
      {/* La poignée : la feuille se glisse vers le bas. */}
      <span
        aria-hidden
        className="mx-auto block h-1 w-9 rounded-full bg-(--gris-clair)"
      />
      <SheetTitle className="font-heading text-[20px] leading-6 font-semibold text-noir">
        {titre}
      </SheetTitle>
      <SheetDescription className="sr-only">
        Donnez un nom, puis créez.
      </SheetDescription>

      <Tabs value={quoi} onValueChange={(v) => setQuoi(v as Quoi)}>
        <TabsList className="h-12! w-full">
          <TabsTrigger value="sujet" disabled={!sujetPossible}>
            <FileTextTrait aria-hidden className="size-[18px]" />
            Un sujet
          </TabsTrigger>
          <TabsTrigger value="dossier" disabled={!dossierPossible}>
            <FolderTrait aria-hidden className="size-[18px]" />
            Un dossier
          </TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="flex flex-col gap-1.5">
        <Label
          htmlFor="nom-ajout"
          className="text-[13px] font-medium text-gris"
        >
          {quoi === "sujet" ? "Nom du sujet" : "Nom du dossier"}
        </Label>
        <Input
          id="nom-ajout"
          autoFocus
          autoComplete="off"
          enterKeyHint="done"
          maxLength={quoi === "sujet" ? 200 : 80}
          value={nom}
          onChange={(e) => setNom(e.target.value)}
          placeholder={quoi === "sujet" ? "Ex. Devis du four" : "Ex. Toulouse"}
          className="h-[50px] text-[17px]"
        />
      </div>

      <Button type="submit" disabled={!pret} className="h-[52px] text-[16px]">
        {quoi === "sujet" ? "Créer le sujet" : "Créer le dossier"}
      </Button>
    </form>
  );
}
