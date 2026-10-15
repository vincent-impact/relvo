"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { Trash } from "@/components/shared/picto";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { ListPanel } from "@/components/shared/list-panel";
import { ZoneHeading } from "@/components/shared/zone-heading";
import { formatRelative } from "@/lib/display";
import {
  listerEchanges,
  viderEchanges,
  type EchangeStocke,
} from "@/lib/echanges-store";

// L'HISTORIQUE des échanges (M10.4, 05 §11.4) — lu sur l'appareil, jamais
// sur le serveur : les dix derniers, titrés, horodatés en relatif ; un appui
// rouvre l'échange entier. « Effacer mon historique » vide la mémoire locale.

export function HistoriqueLocal() {
  const [items, setItems] = useState<EchangeStocke[] | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    void listerEchanges().then(setItems);
  }, []);

  async function effacer() {
    setPending(true);
    await viderEchanges();
    setItems([]);
    setPending(false);
    setConfirm(false);
  }

  return (
    <div className="mt-7">
      <ZoneHeading
        label="Récents"
        hint={items?.length ? String(items.length) : undefined}
      />
      {items === null ? (
        <div className="mx-4 h-[68px] animate-pulse rounded-(--rayon-carte) bg-(--surface)" />
      ) : items.length === 0 ? (
        <p className="px-4 text-[14px] font-light text-gris">
          Vos échanges récents avec Relvo apparaîtront ici. Ils restent sur cet
          appareil.
        </p>
      ) : (
        <>
          <ListPanel>
            {items.map((e) => (
              <Link
                key={e.id}
                href={`/relvo?reprendre=${encodeURIComponent(e.id)}${e.page ? `&from=${encodeURIComponent(e.page)}` : ""}`}
                data-list-row
                className="flex items-center gap-3 border-b border-(--filet) px-3.5 py-3 active:bg-(--fond-enfonce)"
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[14.5px] font-medium text-noir">
                    {e.titre ?? "Échange"}
                  </span>
                  <span className="block text-[12px] font-normal text-gris">
                    {formatRelative(new Date(e.dernierTourLe))}
                    {e.messages.length
                      ? ` · ${Math.ceil(e.messages.length / 2)} tour${e.messages.length > 2 ? "s" : ""}`
                      : ""}
                  </span>
                </span>
                <ChevronRight className="size-4 flex-none text-(--gris-clair)" />
              </Link>
            ))}
          </ListPanel>
          <button
            type="button"
            onClick={() => setConfirm(true)}
            className="mt-4 block w-full py-2 text-center text-[14px] font-medium text-gris active:opacity-80"
          >
            Effacer mon historique
          </button>
          <ConfirmDialog
            open={confirm}
            onOpenChange={setConfirm}
            title="Effacer mon historique ?"
            description="Les échanges enregistrés sur cet appareil seront supprimés. Ce que Relvo a fait pour vous — tâches, affaires, brouillons — reste en place."
            confirmLabel="Effacer"
            tone="destructive"
            icon={Trash}
            pending={pending}
            onConfirm={effacer}
          />
        </>
      )}
    </div>
  );
}
