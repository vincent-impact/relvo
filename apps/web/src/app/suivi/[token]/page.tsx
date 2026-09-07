import type { Metadata } from "next";
import { SuiviTabs } from "@/components/suivi/suivi-tabs";
import donnees from "@/generated/suivi.json";
import s from "./suivi.module.css";

// Page de SUIVI CLIENT (M15.4) — hors de l'application, sans session.
//
// ⚠️ ENTIÈREMENT STATIQUE, et c'est ce qui la protège. `generateStaticParams`
// n'émet QUE le chemin du jeton ; `dynamicParams = false` fait tomber tout le
// reste en 404 sans qu'aucune comparaison n'ait lieu à l'exécution. Il n'y a
// donc pas de secret à comparer, pas de fuite par différence de temps de
// réponse, et rien à deviner : les autres chemins n'existent pas.
//
// ⚠️ L'URL OBSCURE N'EST PAS LA PROTECTION — c'est de la discrétion. Ce qui
// protège, c'est la LISTE BLANCHE du générateur : même divulguée, la page ne
// contient que du frontmatter écrit pour le client. Traiter le jeton comme un
// secret serait se tromper de garde-fou.
//
// ⚠️ AUCUN `fs` ICI. Les données arrivent par un import STATIQUE du JSON écrit
// au build (cf. scripts/generate-suivi.mjs). Lire `backlog/` depuis cette page
// lèverait ENOENT en production seulement.

export const dynamicParams = false;

export const metadata: Metadata = {
  title: "Suivi de projet · Relvo",
  robots: { index: false, follow: false },
};

export function generateStaticParams() {
  const token = process.env.SUIVI_TOKEN?.trim();
  // Jeton absent = aucun chemin généré = la page n'existe nulle part. Un défaut
  // de configuration ferme la porte, il ne l'ouvre pas.
  return token ? [{ token }] : [];
}

// --- présentation --------------------------------------------------------

const PILL: Record<string, { classe: string; libelle: string }> = {
  termine: { classe: s.pillDone, libelle: "Terminé" },
  "en-cours": { classe: s.pillNow, libelle: "En cours" },
  "a-faire": { classe: s.pillNext, libelle: "Prévu" },
  partiel: { classe: s.pillPart, libelle: "Validation en cours" },
};

const BAR: Record<string, string> = {
  termine: s.barDone,
  "en-cours": s.barNow,
  "a-faire": s.barNext,
  partiel: s.barPart,
};

const MOIS_LONGS = [
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

/** « 2026-09-07 » → « 7 septembre ». Pas d'année : la frise en porte une seule. */
function jourLisible(iso: string) {
  const [, m, j] = iso.split("-").map(Number);
  return `${j} ${MOIS_LONGS[m - 1]}`;
}

/** « 2026-11-05 » → « Début nov. » — le futur se dit au mois, jamais au jour. */
function moisLisible(iso: string) {
  const [, m, j] = iso.split("-").map(Number);
  const quand = j <= 10 ? "Début" : j <= 20 ? "Mi-" : "Fin";
  const nom = MOIS_LONGS[m - 1].slice(0, 4);
  return `${quand}${quand === "Mi-" ? "" : " "}${nom}.`;
}

function Chevron() {
  return (
    <svg className={s.chev} viewBox="0 0 16 16" aria-hidden="true">
      <path
        d="M4 6.5 8 10.5l4-4"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function SuiviPage() {
  const { axe, chantiers, livraison, en_cours: enCours, journal } = donnees;

  // Repère « aujourd'hui » et date de pied de page : calculés au BUILD, pas
  // stockés dans le JSON — sinon chaque génération produirait un diff.
  const maintenant = new Date();
  const debutAxe = Date.parse(`${axe.debut}T00:00:00Z`);
  const finAxe = Date.parse(`${axe.fin}T00:00:00Z`);
  const brut = ((maintenant.getTime() - debutAxe) / (finAxe - debutAxe)) * 100;
  const aujourdhui = Math.min(100, Math.max(0, brut));
  const moisCourant = `${MOIS_LONGS[maintenant.getUTCMonth()].slice(0, 3)}`;

  const styleFrise = {
    "--mois": axe.libelles.length,
    "--aujourdhui": `${aujourdhui.toFixed(2)}%`,
  } as React.CSSProperties;

  // ⚠️ `styleFrise` doit envelopper l'axe ET les pistes : `--mois` gouverne le
  // nombre de colonnes et le pas de la grille, `--aujourdhui` la position du
  // repère. Sans lui, la frise retombe sur les valeurs figées de la maquette.
  const avancement = (
    <div style={styleFrise}>
      <p className={s.hint}>
        Chaque ligne est un chantier — touchez-la pour savoir à quoi il sert. La
        barre montre sa durée réelle, le trait violet marque aujourd&apos;hui.
      </p>

      <div className={s.axis} aria-hidden="true">
        {axe.libelles.map((l) => (
          <span
            key={`${l.mois}-${l.annee}`}
            className={l.mois.startsWith(moisCourant) ? s.cur : undefined}
          >
            {l.mois}
          </span>
        ))}
      </div>

      {chantiers.map((c) => {
        const pastille = PILL[c.statut] ?? PILL["a-faire"];
        return (
          <details
            className={s.row}
            key={c.titre}
            open={c.statut === "en-cours"}
          >
            <summary>
              <div className={s.label}>
                <span className={s.lead}>
                  <span className={s.name}>{c.titre}</span>
                  <span className={`${s.pill} ${pastille.classe}`}>
                    {pastille.libelle}
                  </span>
                </span>
                <Chevron />
              </div>
              <div className={s.track}>
                <div
                  className={`${s.bar} ${BAR[c.statut] ?? s.barNext}`}
                  style={{ left: `${c.gauche}%`, width: `${c.largeur}%` }}
                />
              </div>
            </summary>
            <p className={s.why}>{c.resume}</p>
          </details>
        );
      })}

      {livraison ? (
        <details className={`${s.row} ${s.ship}`}>
          <summary>
            <div className={s.label}>
              <span className={s.lead}>
                <span className={s.name}>◆ Livraison</span>
                <span className={`${s.pill} ${s.pillNext}`}>
                  {moisLisible(livraison.date)}
                </span>
              </span>
              <Chevron />
            </div>
            <div className={s.track}>
              <div
                className={s.milestone}
                style={{ left: `${livraison.gauche}%` }}
              />
            </div>
          </summary>
          <p className={s.why}>
            La version complète de Relvo, prête pour un usage quotidien :
            réception des deux canaux, tri automatique, connaissances métier et
            échange avec l&apos;assistant.
          </p>
        </details>
      ) : null}

      <div className={s.legend}>
        <span>
          <i className={s.barDone} /> Terminé
        </span>
        <span>
          <i className={s.barNow} /> En cours
        </span>
        <span>
          <i className={s.barNext} /> Prévu
        </span>
        <span>
          <i className={s.shipMark} /> Livraison
        </span>
      </div>

      <p className={s.aside}>
        <b>Les chantiers à venir sont positionnés au mois, pas au jour.</b> Vous
        recevez une fenêtre précise au moment où un chantier s&apos;ouvre —
        c&apos;est le seul moment où elle est fiable.
      </p>
    </div>
  );

  const journalRendu = (
    <>
      <p className={s.hint}>
        Tout ce qui a changé dans l&apos;application, à chaque mise en ligne.
      </p>
      {journal.length === 0 ? (
        <p className={s.why}>Rien à afficher pour le moment.</p>
      ) : (
        journal.map((j) => (
          <div className={s.day} key={j.date}>
            <div className={s.date}>{jourLisible(j.date)}</div>
            <ul className={s.entries}>
              {j.entrees.map((e, i) => (
                <li className={s.entry} key={`${j.date}-${i}`}>
                  <span
                    className={`${s.tag} ${e.type === "new" ? s.tagNew : s.tagFix}`}
                  >
                    {e.type === "new" ? "Nouveau" : "Corrigé"}
                  </span>
                  <p>{e.texte}</p>
                </li>
              ))}
            </ul>
          </div>
        ))
      )}
    </>
  );

  return (
    <div className={s.page}>
      <header className={s.hero}>
        <div className={s.eyebrow}>Tasty Crousty · Suivi de projet</div>
        <h1>Relvo</h1>
        <p>
          Où en est votre application, et ce qui change à chaque mise à jour.
        </p>
      </header>

      <div className={s.straddle}>
        <div className={s.cell}>
          <span className={s.k}>État</span>
          <span className={s.v}>Bêta privée</span>
        </div>
        <div className={s.cell}>
          <span className={s.k}>En cours</span>
          <span className={`${s.v} ${s.now}`}>{enCours ?? "—"}</span>
        </div>
        <div className={s.cell}>
          <span className={s.k}>Livraison</span>
          <span className={s.v}>
            {livraison ? moisLisible(livraison.date) : "—"}
          </span>
        </div>
      </div>

      <SuiviTabs
        classes={{ tabs: s.tabs }}
        avancement={<div className={s.main}>{avancement}</div>}
        journal={<div className={s.main}>{journalRendu}</div>}
      />

      <footer className={s.footer}>
        <p>
          Cette page se met à jour automatiquement à chaque livraison.
          <br />
          Dernière mise à jour :{" "}
          {jourLisible(maintenant.toISOString().slice(0, 10))}{" "}
          {maintenant.getUTCFullYear()} · Une question ?{" "}
          <a href="mailto:vincent@vccimpact.fr">vincent@vccimpact.fr</a>
        </p>
      </footer>
    </div>
  );
}
