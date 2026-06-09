import type { AccountRole } from "@relvo/db";
import type { DefaultSession } from "next-auth";

// Augmentation des types Auth.js : on transporte l'id du compte (= tenant
// account_id, invariant n°1) et le rôle dans la session et le JWT.

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: AccountRole;
    } & DefaultSession["user"];
  }

  interface User {
    role?: AccountRole;
  }
}

// NB : on n'augmente pas "next-auth/jwt". Le type JWT réel vit dans
// "@auth/core/jwt", non résolvable depuis apps/web avec pnpm — l'augmentation
// ne fusionnerait pas. Les claims accountId/role sont écrits via l'index
// signature du JWT et relus avec un cast explicite dans auth.ts.
