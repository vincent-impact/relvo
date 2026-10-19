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

const SESSION = {
  user: { id: "00000000-0000-4000-8000-000000000001", role: "ceo" },
};
const SESSION_ADMIN = {
  user: { id: "00000000-0000-4000-8000-000000000002", role: "admin" },
};

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

  // La page d'attente de l'inscription (M21.6) vit sous `/inscription` : elle
  // passe par le préfixe, sans entrée de plus dans la liste blanche.
  it("ouvre la page d'attente de l'inscription sans session", () => {
    expect(passe("/inscription/attente", null)).toBe(true);
  });
});

// LA ZONE D'ADMINISTRATION (M21.1) : fermée aux visiteurs, renvoyée à l'accueil
// pour un compte connecté sans le rôle, ouverte au seul rôle `admin`.
describe("la zone /admin", () => {
  const ADMIN = ["/admin", "/admin/comptes/abc", "/admin/invitations"];

  it("exige une session", () => {
    expect(ADMIN.filter((r) => passe(r, null))).toEqual([]);
  });

  it("renvoie un compte sans le rôle vers l'accueil, pas vers la connexion", () => {
    for (const r of ADMIN) {
      const verdict = autorise({
        auth: SESSION,
        request: { nextUrl: new URL(`https://relvo.test${r}`) },
      });
      expect(verdict).toBeInstanceOf(Response);
      const res = verdict as Response;
      expect(res.status).toBe(302);
      expect(new URL(res.headers.get("location")!).pathname).toBe("/");
    }
  });

  it("laisse passer un administrateur", () => {
    expect(ADMIN.filter((r) => !passe(r, SESSION_ADMIN))).toEqual([]);
  });

  it("ne confond pas `/administration` ou `/admins` avec la zone", () => {
    expect(passe("/administration", SESSION)).toBe(true);
    expect(passe("/admins", SESSION)).toBe(true);
  });
});
