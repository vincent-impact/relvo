import NextAuth, { type NextAuthConfig } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import { authConfig } from "@/auth.config";
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
    // Google : retrouve le compte par email ou le crée (signup public ouvert),
    // et lie l'identité Google. Refuse un compte désactivé.
    async signIn({ user, account, profile }) {
      if (account?.provider !== "google") return true;

      const email = (profile?.email ?? user.email)?.trim().toLowerCase();
      if (!email) return false;

      const existing = await prisma.account.findUnique({ where: { email } });

      if (existing) {
        if (!existing.isActive) return false;
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
      });
      return true;
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
    async session({ session, token }) {
      // token.accountId/role sont posés dans le callback jwt ci-dessus. Le type
      // JWT d'@auth/core n'étant pas augmentable proprement avec pnpm, on cast
      // ici ; la session, elle, est typée (cf. types/next-auth.d.ts).
      if (token.accountId) session.user.id = token.accountId as string;
      if (token.role)
        session.user.role = token.role as typeof session.user.role;
      return session;
    },
  },
};

export const { handlers, auth, signIn, signOut } = NextAuth(config);
