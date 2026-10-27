import type { AdminAccountJournal } from "@relvo/db";
import { ActorPill } from "@/components/shared/actor-pill";
import { ListPanel } from "@/components/shared/list-panel";
import { ZoneHeading } from "@/components/shared/zone-heading";
import { cn } from "@/lib/utils";
import { depuis, eur } from "./format";

// Le journal de l'inférence rendu en page (M21.3) : ce que `ia:journal`
// imprime, par sollicitation, puis les silencieux, les tours en échec, les
// rattrapages, les questions ouvertes et le journal de bord récent.

function pct(n: number, d: number): string {
  return d === 0 ? "—" : `${Math.round((100 * n) / d)} %`;
}

const LIBELLE_RATTRAPAGE: Record<string, string> = {
  pending: "en attente",
  running: "en cours",
  done: "terminé",
  capped: "plafonné",
  failed: "en échec",
};

export function AccountJournal({
  fiche,
  now,
}: {
  fiche: AdminAccountJournal;
  now: Date;
}) {
  return (
    <>
      <section>
        <ZoneHeading
          label="Par sollicitation"
          hint={fiche.synthese.length ? "30 derniers jours" : undefined}
        />
        {fiche.synthese.length ? (
          <ListPanel>
            {fiche.synthese.map((s) => (
              <div
                key={s.sollicitation}
                data-list-row
                className="border-b border-(--filet) px-4 py-3"
              >
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-[14.5px] font-medium text-noir">
                    {s.sollicitation}
                  </span>
                  <span className="chiffre text-[14px] font-normal text-noir">
                    {eur(s.coutEur)}
                    <span className="font-light text-gris">
                      {" "}
                      · {s.appels} appel{s.appels > 1 ? "s" : ""}
                    </span>
                  </span>
                </div>
                <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[12px] leading-4 font-normal text-gris">
                  <span>{eur(s.coutEur / s.appels)} / appel</span>
                  <span>entrée {Math.round(s.entree / s.appels)}</span>
                  <span>
                    sortie {Math.round(s.sortie / s.appels)} (
                    {Math.round(s.raisonnement / s.appels)} raisonnement)
                  </span>
                  {s.audioSecondes ? (
                    <span>audio {(s.audioSecondes / 60).toFixed(1)} min</span>
                  ) : null}
                  <span>{s.dureeMsMoyenne} ms</span>
                  <span>
                    cache relu{" "}
                    {s.mesures
                      ? pct(s.cacheLectureMesuree, s.prefixeStable)
                      : "non mesuré"}
                  </span>
                  {s.mesures ? (
                    <span
                      className={cn(s.silencieux.length && "text-(--attente)")}
                    >
                      {s.silencieux.length}/{s.mesures} silencieux
                    </span>
                  ) : null}
                </div>
              </div>
            ))}
          </ListPanel>
        ) : (
          <p className="px-4 text-[14px] font-light text-gris">
            Aucune sollicitation sur 30 jours.
          </p>
        )}
        {fiche.nonMesures ? (
          <p className="mt-2 px-4 text-[12px] font-light text-gris">
            {fiche.nonMesures} appel{fiche.nonMesures > 1 ? "s" : ""} sans
            préfixe mesuré (antérieurs à la mesure, brouillons ou dictées).
          </p>
        ) : null}
      </section>

      {fiche.silencieux.length ? (
        <section>
          <ZoneHeading label="Silencieux" hint="le cache aurait dû jouer" />
          <ListPanel>
            {fiche.silencieux.slice(0, 10).map((r, i) => (
              <div
                key={`${r.at.toISOString()}-${i}`}
                data-list-row
                className="flex items-baseline justify-between gap-3 border-b border-(--filet) px-4 py-2.5 text-[13px]"
              >
                <span className="min-w-0 truncate font-normal text-noir">
                  {r.sollicitation}
                  <span className="font-light text-gris"> · {r.modele}</span>
                </span>
                <span className="chiffre flex-none text-gris">
                  {r.jetons.cacheLecture} / {r.prefixeStable} ·{" "}
                  {depuis(r.at, now)}
                </span>
              </div>
            ))}
          </ListPanel>
        </section>
      ) : null}

      <section>
        <ZoneHeading
          label="Tours en échec"
          hint={fiche.echecs.length ? `${fiche.echecs.length}` : undefined}
        />
        {fiche.echecs.length ? (
          <ListPanel>
            {fiche.echecs.map((e, i) => (
              <div
                key={`${e.at.toISOString()}-${i}`}
                data-list-row
                className="border-b border-(--filet) px-4 py-2.5 text-[13px]"
              >
                <div className="flex items-baseline justify-between gap-3">
                  <span className="font-normal text-noir">
                    {e.sollicitation}
                    <span className="text-urgent"> · {e.motif}</span>
                  </span>
                  <span className="chiffre flex-none text-gris">
                    {depuis(e.at, now)}
                  </span>
                </div>
                {e.detail ? (
                  <div className="mt-0.5 line-clamp-2 text-[12px] leading-4 font-light text-gris">
                    {e.detail}
                  </div>
                ) : null}
              </div>
            ))}
          </ListPanel>
        ) : (
          <p className="px-4 text-[14px] font-light text-gris">
            Aucun échec sur 30 jours.
          </p>
        )}
      </section>

      {fiche.rattrapages.length ? (
        <section>
          <ZoneHeading label="Rattrapages" />
          <ListPanel>
            {fiche.rattrapages.map((r) => (
              <div
                key={r.id}
                data-list-row
                className="border-b border-(--filet) px-4 py-2.5 text-[13px]"
              >
                <div className="flex items-baseline justify-between gap-3">
                  <span className="font-normal text-noir">
                    {r.channelName}
                    <span
                      className={cn(
                        "font-light",
                        r.status === "failed" ? "text-urgent" : "text-gris",
                      )}
                    >
                      {" "}
                      · {LIBELLE_RATTRAPAGE[r.status] ?? r.status}
                    </span>
                  </span>
                  <span className="chiffre flex-none text-gris">
                    {depuis(r.finishedAt ?? r.requestedAt, now)}
                  </span>
                </div>
                <div className="mt-0.5 text-[12px] leading-4 font-light text-gris">
                  {r.messagesImported} messages · {r.subjectsOpened} sujets ·{" "}
                  {r.conversationsIgnored} ignorées · {eur(r.costEur)}
                  {r.lastError ? ` · ${r.lastError}` : ""}
                </div>
              </div>
            ))}
          </ListPanel>
        </section>
      ) : null}

      {fiche.questions.length ? (
        <section>
          <ZoneHeading label="Questions ouvertes" />
          <ListPanel>
            {fiche.questions.map((q) => (
              <div
                key={q.id}
                data-list-row
                className="border-b border-(--filet) px-4 py-2.5 text-[13px] font-normal text-noir"
              >
                {q.text}
                {q.about ? (
                  <span className="font-light text-gris">
                    {" "}
                    · {q.about.label}
                  </span>
                ) : null}
              </div>
            ))}
          </ListPanel>
        </section>
      ) : null}

      <section>
        <ZoneHeading label="Journal récent" hint="50 dernières entrées" />
        {fiche.journal.length ? (
          <ListPanel>
            {fiche.journal.map((e, i) => (
              <div
                key={`${e.at.toISOString()}-${i}`}
                data-list-row
                className="flex items-center gap-2.5 border-b border-(--filet) px-4 py-2 text-[13px]"
              >
                <ActorPill actor={e.actor} className="flex-none" />
                <span className="min-w-0 flex-1 truncate font-normal text-noir">
                  {e.title}
                </span>
                <span className="chiffre flex-none text-[12px] text-gris">
                  {depuis(e.at, now)}
                </span>
              </div>
            ))}
          </ListPanel>
        ) : (
          <p className="px-4 text-[14px] font-light text-gris">Journal vide.</p>
        )}
      </section>
    </>
  );
}
