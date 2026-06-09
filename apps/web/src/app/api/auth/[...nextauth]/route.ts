import { handlers } from "@/auth";

// Endpoints Auth.js (signin/callback/signout/session…). Runtime Node (par
// défaut) : le provider Credentials utilise bcrypt + Prisma.
export const { GET, POST } = handlers;
