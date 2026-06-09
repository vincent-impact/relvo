import NextAuth from "next-auth";
import { authConfig } from "@/auth.config";

// Next.js 16 a renommé `middleware.ts` → `proxy.ts`. On instancie Auth.js à
// partir de la config **edge-safe** (sans Prisma ni bcrypt) : le callback
// `authorized` décide, à partir de la session décodée du cookie JWT, si la
// requête passe ou est redirigée vers /connexion.
export const { auth: proxy } = NextAuth(authConfig);

export const config = {
  // Tout sauf : routes API, assets Next, fichiers statiques.
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
