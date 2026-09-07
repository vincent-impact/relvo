import { describe, expect, it } from "vitest";
import { authConfig } from "@/auth.config";

// LE REFUS PAR DÉFAUT (M15.6) — le test qui manquait le plus au dépôt.
//
// Il accompagne l'ouverture d'une route publique, et c'est délibéré : ajouter
// une entrée à PUBLIC_ROUTES est exactement le geste contre lequel il protège.
// Une liste blanche d'accès qu'aucun test ne surveille finit par s'allonger,
// une ligne à la fois, sans que personne ne mesure ce qui vient de s'ouvrir.
//
// ⚠️ LA LISTE ATTENDUE EST RECOPIÉE ICI, PAS IMPORTÉE. L'importer rendrait le
// test tautologique : il se contenterait de vérifier qu'une liste est égale à
// elle-même, et passerait au vert quel que soit son contenu. Recopiée, toute
// divergence entre l'intention (ici) et le code (auth.config) fait échouer —
// dans les DEUX sens : une route retirée casse « les routes publiques passent »,
// une route ajoutée en douce casse « rien d'autre ne passe ».
//
// ⚠️ Ce test rappelle aussi ce que le proxy NE couvre PAS : il raisonne sur des
// CHEMINS. Une Server Action n'en a pas, et le filtre exclut les routes d'API —
// la protection par le client conscient du tenant reste la ligne qui compte
// hors navigation de page (cf. PITFALLS.md #30).

/** Ce que l'on ACCEPTE de laisser ouvert, énoncé indépendamment du code. */
const ROUTES_PUBLIQUES = [
  "/connexion",
  "/inscription",
  "/mot-de-passe-oublie",
  "/reinitialiser-mot-de-passe",
  "/verifier-email",
  "/suivi",
];

/** Un échantillon de ce qui doit rester fermé, dont la racine. */
const ROUTES_PROTEGEES = [
  "/",
  "/fil",
  "/conversations",
  "/conversations/abc",
  "/contacts",
  "/contacts/abc",
  "/parametres",
  "/planning",
  "/relvo",
  "/sujets/abc",
  "/dossiers",
  "/recherche",
];

type Verdict = boolean | Response | undefined;
type Autorise = (args: {
  auth: { user?: unknown } | null;
  request: { nextUrl: URL };
}) => Verdict;

const autorise = authConfig.callbacks.authorized as unknown as Autorise;

const SESSION = { user: { id: "00000000-0000-4000-8000-000000000001" } };

function passe(chemin: string, session: { user?: unknown } | null): boolean {
  return (
    autorise({
      auth: session,
      request: { nextUrl: new URL(`https://relvo.test${chemin}`) },
    }) === true
  );
}

describe("refus par défaut du proxy d'authentification", () => {
  it("refuse TOUTE route protégée à un visiteur sans session", () => {
    const ouvertesParErreur = ROUTES_PROTEGEES.filter((r) => passe(r, null));
    expect(ouvertesParErreur).toEqual([]);
  });

  it("laisse passer les routes protégées quand la session existe", () => {
    const refuseesAtort = ROUTES_PROTEGEES.filter((r) => !passe(r, SESSION));
    expect(refuseesAtort).toEqual([]);
  });

  it("laisse passer les routes publiques SANS session", () => {
    const fermeesAtort = ROUTES_PUBLIQUES.filter((r) => !passe(r, null));
    expect(fermeesAtort).toEqual([]);
  });

  it("ouvre les sous-chemins d'une route publique, pas ses homographes", () => {
    // `/suivi/<jeton>` doit passer — c'est la page de suivi elle-même.
    expect(passe("/suivi/un-jeton-quelconque", null)).toBe(true);
    // `/suivix` n'est PAS `/suivi` : un préfixe ne doit pas ouvrir un voisin.
    expect(passe("/suivix", null)).toBe(false);
    expect(passe("/suivi-interne", null)).toBe(false);
  });

  it("ne laisse passer AUCUNE autre racine que celles déclarées", () => {
    const inconnues = ["/admin", "/debug", "/backlog", "/interne", "/api-docs"];
    const ouvertes = inconnues.filter((r) => passe(r, null));
    expect(ouvertes).toEqual([]);
  });
});
