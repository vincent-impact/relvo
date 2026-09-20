import type { Metadata } from "next";
import Link from "next/link";
import { RelvoHeader } from "@/components/layout/relvo-header";
import { RelvoLogo } from "@/components/layout/relvo-logo";
import { Screen } from "@/components/layout/screen";
import { DemoNotice } from "@/components/shared/demo-notice";
import { ZoneHeading } from "@/components/shared/zone-heading";
import { BILAN_DEMO } from "@/lib/demo-bilan";
import { cn } from "@/lib/utils";
import { requireAccount } from "@/server/auth-context";

export const metadata: Metadata = { title: "Bilan — Relvo" };

// Bilan — DEUX familles de chiffres, deux domiciles, jamais mêlées (invariant
// 37) : « Ce que Relvo a fait pour vous » (cumulatif, justifie le produit) et
// « Où en êtes-vous » (un flux sur sept jours, parle de productivité). Jamais de
// « temps gagné » : c'est un chiffre inventé, et le public le sentira.
//
// ⚠️ MAQUETTE ANNONCÉE : les chiffres viennent de `lib/demo-bilan.ts`, pas du
// journal — la page le dit en tête. Le branchement sur le journal est un
// chantier à part (chaque chiffre lu du journal, un tap ouvre la liste derrière).

const MONTHS = [
  "janvier",
  "février",
  "mars",
  "avril",
  "mai",
  "juin",
  "juillet",
  "août",
  "septembre",
  "octobre",
  "novembre",
  "décembre",
];

type Periode = "mois" | "tout";

function PeriodeSwitch({ periode }: { periode: Periode }) {
  const items: { value: Periode; label: string; href: string }[] = [
    { value: "mois", label: "Mois", href: "/bilan" },
    { value: "tout", label: "Tout", href: "/bilan?periode=tout" },
  ];
  return (
    <div
      role="tablist"
      className="inline-flex flex-none rounded-[9px] p-[2px]"
      style={{
        background: "rgb(255 255 255 / 0.14)",
        border: "1px solid rgb(255 255 255 / 0.22)",
      }}
    >
      {items.map((it) => {
        const active = it.value === periode;
        return (
          <Link
            key={it.value}
            href={it.href}
            role="tab"
            aria-selected={active}
            className={cn(
              "rounded-[7px] px-2.5 py-[5px] text-[12px] font-semibold",
              active ? "bg-[#fafafa] text-relvo" : "text-white",
            )}
          >
            {it.label}
          </Link>
        );
      })}
    </div>
  );
}

export default async function BilanPage({
  searchParams,
}: {
  searchParams: Promise<{ periode?: string }>;
}) {
  await requireAccount();
  const { periode: p } = await searchParams;
  const periode: Periode = p === "tout" ? "tout" : "mois";
  const now = new Date();
  const monthLabel = `${MONTHS[now.getMonth()]} ${now.getFullYear()}`;
  const tiles = BILAN_DEMO.relvo[periode];
  const flux = BILAN_DEMO.flux;
  const total = flux.messagesParJour.reduce((s, d) => s + d.n, 0);
  const max = Math.max(...flux.messagesParJour.map((d) => d.n), 1);

  return (
    <Screen>
      <RelvoHeader
        back="/"
        title="Bilan"
        subtitle={
          periode === "mois"
            ? `${monthLabel.charAt(0).toUpperCase()}${monthLabel.slice(1)} · depuis le 1er`
            : "Depuis le début"
        }
        action={<PeriodeSwitch periode={periode} />}
        className="pb-5"
      />

      <div className="space-y-5 pt-4">
        <DemoNotice>
          Chiffres de démonstration : cette page n&apos;est pas encore reliée à
          votre journal. La disposition est la bonne, les valeurs ne le sont
          pas.
        </DemoNotice>

        <section>
          <ZoneHeading
            label="Ce que Relvo a fait pour vous"
            hint={
              <span className="inline-flex items-center gap-1.5 font-semibold text-relvo">
                <RelvoLogo size={14} title="" />
                Relvo
              </span>
            }
          />
          <div className="mx-4 grid grid-cols-2 overflow-hidden rounded-[14px] border border-(--hairline) bg-white shadow-surface-1">
            {tiles.map((t, i) => (
              <div
                key={t.label}
                className={cn(
                  "px-3.5 py-3",
                  i % 2 === 0 && "border-r border-(--border-light)",
                  i < tiles.length - 2 && "border-b border-(--border-light)",
                )}
              >
                <div className="font-numeric text-[26px] leading-none font-semibold tabular-nums">
                  {t.value}
                </div>
                <div className="mt-[5px] text-[12px] text-(--text-secondary)">
                  {t.label}
                </div>
              </div>
            ))}
          </div>
          <p className="mx-[18px] mt-2 text-[12px] leading-[1.4] text-(--text-secondary)">
            Chaque chiffre viendra du journal. Un tap ouvrira la liste derrière.
          </p>
        </section>

        <section>
          <ZoneHeading label="Où en êtes-vous" hint="7 derniers jours" />
          <div className="mx-4 rounded-[14px] border border-(--hairline) bg-white px-3.5 pt-3 pb-2.5 shadow-surface-1">
            <div className="mb-2 flex items-baseline justify-between">
              <span className="text-[14.5px] font-medium">
                Messages reçus par jour
              </span>
              <span className="font-numeric text-[12.5px] text-(--text-secondary) tabular-nums">
                {total} au total
              </span>
            </div>
            <div
              className="flex h-24 items-end gap-1.5"
              role="img"
              aria-label={`Messages reçus par jour, du lundi au dimanche : ${flux.messagesParJour.map((d) => d.n).join(", ")}.`}
            >
              {flux.messagesParJour.map((d) => (
                <div
                  key={d.jour}
                  className="flex h-full flex-1 flex-col items-center justify-end gap-1"
                >
                  {d.n === max ? (
                    <span className="font-numeric text-[11px] text-(--text-secondary)">
                      {d.n}
                    </span>
                  ) : null}
                  <span
                    className="w-full rounded-t-[4px] bg-(--purple-600)"
                    style={{ height: `${Math.max(4, (d.n / max) * 70)}px` }}
                  />
                  <span className="text-[11px] text-(--text-secondary)">
                    {d.jour}
                  </span>
                </div>
              ))}
            </div>
          </div>
          <div className="mx-4 mt-2.5 rounded-[14px] border border-(--hairline) bg-white shadow-surface-1">
            {[
              {
                t1: "Sujets",
                t2: `${flux.sujetsOuverts} ouverts · ${flux.sujetsFermes} fermés cette semaine`,
                v: `+${flux.sujetsOuverts - flux.sujetsFermes}`,
              },
              {
                t1: "Tâches faites",
                t2: `sur ${flux.tachesDues} dues`,
                v: String(flux.tachesFaites),
              },
              {
                t1: "Délai médian de réponse",
                t2: "entre un message reçu et votre envoi",
                v: flux.delaiMedian,
              },
              {
                t1: "En retard",
                t2: "tâches dépassées, non faites",
                v: String(flux.enRetard),
                red: flux.enRetard > 0,
              },
            ].map((r, i, all) => (
              <div
                key={r.t1}
                className={cn(
                  "flex items-center gap-3 px-3.5 py-3",
                  i < all.length - 1 && "border-b border-(--border-light)",
                )}
              >
                <div className="min-w-0 flex-1">
                  <div className="text-[14.5px] leading-[1.25] font-medium">
                    {r.t1}
                  </div>
                  <div className="mt-0.5 text-[12px] text-(--text-secondary)">
                    {r.t2}
                  </div>
                </div>
                <span
                  className={cn(
                    "font-numeric text-[15px] font-semibold tabular-nums",
                    r.red && "text-(--red-600)",
                  )}
                >
                  {r.v}
                </span>
              </div>
            ))}
          </div>
        </section>
      </div>
    </Screen>
  );
}
