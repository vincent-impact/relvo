import NextAuth from "next-auth";
import { authConfig } from "@/auth.config";

// Next.js 16 a renommé `middleware.ts` → `proxy.ts`. On instancie Auth.js à
// partir de la config **edge-safe** (sans Prisma ni bcrypt) : le callback
// `authorized` décide, à partir de la session décodée du cookie JWT, si la
// requête passe ou est redirigée vers /connexion.
//
// ⚠️ DEUX pièges, et il faut les deux pour que ce fichier serve à quelque chose.
//
// #5b — EMPLACEMENT. Le projet utilise un dossier `src/` : posé un cran plus
// haut (à la racine de l'app), ce fichier n'est JAMAIS compilé — sans erreur ni
// avertissement. Le seul indicateur fiable est la ligne « ƒ Proxy (Middleware) »
// en fin de sortie de build ; `.next/server/middleware-manifest.json` n'en est
// pas un (il reste `{"middleware":{}}` même quand le proxy fonctionne).
//
// #5c — FORME DE L'EXPORT. ⚠️ Le piège s'APPLIQUE à cette version (constaté au
// build) : `export const { auth: proxy } = NextAuth(authConfig)` échoue avec
// « must export a function, either as a default export or as a named "proxy"
// export ». Next analyse ce fichier STATIQUEMENT et ne voit aucune fonction
// derrière une déstructuration. D'où l'export default explicite ci-dessous —
// ne pas le « simplifier » en réintroduisant la déstructuration.
const { auth } = NextAuth(authConfig);

export default auth;

export const config = {
  // Tout sauf : routes API, assets Next, fichiers statiques.
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
