import Link from "next/link";
import { ChevronRight } from "lucide-react";
import type { AdminAccountRow } from "@relvo/db";
import { Flask } from "@/components/shared/picto";
import { cn } from "@/lib/utils";
import { ActivateButton } from "./activate-button";
import { depuis, eur, pluriel } from "./format";

// Une ligne de la liste des comptes (M21.2) — dans UNE carte, un filet entre
// les lignes (ListPanel). Le nom, l'adresse, l'état en un mot, et les chiffres
// qui décident : coût 7 j / 30 j, sujets ouverts, canaux, dernière activité.
// Un compte en attente porte son bouton d'ouverture ici même : c'est le geste
// du jour J, il ne mérite pas un écran de plus.

export function AccountRow({
  compte,
  now,
}: {
  compte: AdminAccountRow;
  now: Date;
}) {
  const enAttente = compte.activatedAt === null;
  const nom = `${compte.firstName} ${compte.lastName}`.trim() || compte.email;
  const canauxOk = compte.channels.filter(
    (c) => c.status === "connected",
  ).length;
  const canauxKo = compte.channels.filter((c) => c.status === "error").length;
  // Dix boîtes par compte (M24) : le nombre se lit ici dès la deuxième.
  const boites = compte.channels.filter((c) => c.type === "email").length;

  return (
    <div
      data-list-row
      className="flex items-center gap-3 border-b border-(--filet) px-4 py-3"
    >
      <Link
        href={`/admin/comptes/${compte.id}`}
        className="flex min-w-0 flex-1 items-center gap-3 active:opacity-80"
      >
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-1.5">
            <span className="truncate text-[15px] font-medium text-noir">
              {nom}
            </span>
            {compte.isTest ? (
              <Flask
                className="size-3.5 flex-none text-gris"
                title="Compte test"
              />
            ) : null}
            {compte.role === "admin" ? (
              <span className="flex-none rounded-full bg-relvo-bg px-1.5 py-px text-[10.5px] font-medium text-relvo">
                admin
              </span>
            ) : null}
          </div>
          <div className="truncate text-[12.5px] font-normal text-gris">
            {compte.email}
          </div>
          <div className="mt-1 flex flex-wrap gap-x-2.5 gap-y-0.5 text-[12px] leading-4 font-normal text-gris">
            {enAttente ? (
              <span className="text-(--attente)">en attente</span>
            ) : (
              <>
                <span
                  className={cn(
                    "chiffre",
                    compte.coutEurCourt > 0 ? "text-noir" : "text-gris",
                  )}
                >
                  {eur(compte.coutEurCourt)}
                  <span className="text-gris"> / 7 j</span>
                </span>
                <span className="chiffre">
                  {eur(compte.coutEurLong)}
                  <span className="text-gris"> / 30 j</span>
                </span>
                <span>{pluriel(compte.openSubjects, "sujet", "sujets")}</span>
                <span>
                  {compte.channels.length === 0
                    ? "aucun canal"
                    : `${canauxOk}/${compte.channels.length} ${compte.channels.length > 1 ? "canaux" : "canal"}`}
                  {boites > 1 ? ` · ${boites} boîtes` : ""}
                  {canauxKo ? (
                    <span className="text-urgent"> · {canauxKo} en erreur</span>
                  ) : null}
                </span>
                {!compte.assistantEnabled ? (
                  <span className="text-urgent">assistant coupé</span>
                ) : null}
                <span>{depuis(compte.lastActivityAt, now)}</span>
              </>
            )}
          </div>
        </div>
        {enAttente ? null : (
          <ChevronRight
            className="size-4 flex-none text-(--gris-clair)"
            strokeWidth={2.2}
          />
        )}
      </Link>
      {enAttente ? (
        <ActivateButton accountId={compte.id} email={compte.email} />
      ) : null}
    </div>
  );
}
