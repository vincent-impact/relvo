import NextAuth, { type NextAuthConfig } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import { authConfig } from "@/auth.config";
import { AccesEnAttente } from "@/lib/auth-errors";
import { prisma } from "@/lib/db";
import { verifyPassword } from "@/lib/password";
import { loginSchema } from "@/lib/validations";
import { createAccount } from "@/server/account";

// Google n'est branché que si les identifiants OAuth sont présents : l'app
// reste pleinement fonctionnelle en Credentials seul tant que les clés Google
// ne sont pas configurées.
const googleEnabled = Boolean(
  process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET,
);

const config: NextAuthConfig = {
  ...authConfig,
  // Sessions JWT (cookie) : pas de table Session — 1 compte = 1 humain, le
  // token suffit (cf. spec architecture §5).
  session: { strategy: "jwt" },
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Mot de passe", type: "password" },
      },
      authorize: async (credentials) => {
        const parsed = loginSchema.safeParse(credentials);
        if (!parsed.success) return null;

        const { email, password } = parsed.data;
        const account = await prisma.account.findUnique({ where: { email } });

        // Compte inexistant, inactif, ou sans mot de passe local (Google-only).
        if (!account || !account.isActive || !account.passwordHash) {
          return null;
        }

        const valid = await verifyPassword(password, account.passwordHash);
        if (!valid) return null;

        // La porte de l'alpha (M21.6) : identifiants justes, accès pas encore
        // ouvert par un administrateur. Une erreur à part, pas « incorrect ».
        if (!account.activatedAt) throw new AccesEnAttente();

        return {
          id: account.id,
          email: account.email,
          name: `${account.firstName} ${account.lastName}`.trim(),
          image: account.image,
          role: account.role,
        };
      },
    }),
    ...(googleEnabled
      ? [Google({ allowDangerousEmailAccountLinking: true })]
      : []),
  ],
  callbacks: {
    ...authConfig.callbacks,
    // Google : retrouve le compte par email ou le crée, et lie l'identité
    // Google. Refuse un compte désactivé. La porte de l'alpha (M21.6) vaut ici
    // aussi : un compte dont l'accès n'est pas ouvert — qu'il naisse à l'instant
    // ou qu'il attende déjà — est renvoyé vers la page d'attente.
    async signIn({ user, account, profile }) {
      if (account?.provider !== "google") return true;

      const email = (profile?.email ?? user.email)?.trim().toLowerCase();
      if (!email) return false;

      const existing = await prisma.account.findUnique({ where: { email } });

      if (existing) {
        if (!existing.isActive) return false;
        if (!existing.activatedAt) return "/inscription/attente";
        await prisma.account.update({
          where: { id: existing.id },
          data: {
            googleId: existing.googleId ?? account.providerAccountId,
            image: existing.image ?? user.image,
            // Google a vérifié l'email pour nous.
            emailVerified: existing.emailVerified ?? new Date(),
          },
        });
        return true;
      }

      // Pas de compte → création (Folder Général + EventLog inclus).
      const [firstName, ...rest] = (profile?.name ?? user.name ?? email)
        .trim()
        .split(" ");
      await createAccount({
        email,
        firstName: firstName || email,
        lastName: rest.join(" "),
        googleId: account.providerAccountId,
        image: user.image,
        emailVerified: new Date(),
        activated: false,
      });
      return "/inscription/attente";
    },
    // Au sign-in, on garnit le token avec l'account_id (tenant) et le rôle.
    // Pour Credentials, `user` les porte déjà ; pour Google, on résout par email.
    async jwt({ token, user }) {
      if (user) {
        if (user.id && user.role) {
          token.accountId = user.id;
          token.role = user.role;
        } else if (user.email) {
          const account = await prisma.account.findUnique({
            where: { email: user.email.toLowerCase() },
          });
          if (account) {
            token.accountId = account.id;
            token.role = account.role;
          }
        }
      }
      return token;
    },
    // Le callback `session` (jeton → session) vit dans `auth.config.ts` : le
    // proxy en a besoin pour lire le rôle (zone d'administration, M21.1).
  },
};

export const { handlers, auth, signIn, signOut } = NextAuth(config);
