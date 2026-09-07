import type { MetadataRoute } from "next";

// robots.txt (M15.5).
//
// L'application entière vit derrière une session : rien n'y est indexable. La
// page de suivi client, elle, est PUBLIQUE — d'où une interdiction explicite.
//
// ⚠️ Le vrai garde-fou n'est PAS ce fichier : robots.txt est une convention que
// rien n'oblige à respecter. Ce qui empêche l'indexation est le `noindex` porté
// par la page elle-même (`metadata.robots` dans /suivi/[token]). Ce fichier
// évite le passage d'un crawler poli ; le meta évite la fiche dans un index.
//
// ⚠️ Nommer `/suivi/` ici RÉVÈLE le préfixe — jamais le jeton. C'est assumé :
// la protection de cette page est la liste blanche du générateur, pas
// l'obscurité de son URL. Une page dont le contenu ne gêne pas divulguée peut
// se permettre d'annoncer son existence.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", disallow: ["/suivi/", "/api/"] }],
  };
}
