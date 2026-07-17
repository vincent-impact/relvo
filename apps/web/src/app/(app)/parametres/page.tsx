import type { Metadata } from "next";
import { Suspense } from "react";
import { LogOut, MessageCircle, Mail } from "lucide-react";
import { DEMO_EMAIL } from "@relvo/db";
import { ConnectEmailButton } from "@/components/settings/connect-email-button";
import { ChannelDeleteButton } from "@/components/settings/channel-delete-button";
import { ContactsPane } from "@/components/contacts/contacts-pane";
import { FeedTabs } from "@/components/feed/feed-tabs";
import { RelvoHeader } from "@/components/layout/relvo-header";
import { Screen } from "@/components/layout/screen";
import { TabsSkeleton } from "@/components/shared/screen-skeletons";
import { PasswordForm } from "@/components/settings/password-form";
import { PreferencesToggles } from "@/components/settings/preferences-toggles";
import { ProfileForm } from "@/components/settings/profile-form";
import { ResetDemoButton } from "@/components/settings/reset-demo-button";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { logoutAction } from "@/server/actions/auth";
import { cachedContacts } from "@/server/cached";
import { getTenantDb, requireAccount } from "@/server/auth-context";

export const metadata: Metadata = { title: "Paramètres — Relvo" };

// Le reset du compte démo (Server Action invoquée depuis cette page) recrée
// beaucoup d'objets (29 sujets + 115 tâches + journaux) → on relève le plafond
// de durée de la fonction serverless pour éviter un timeout (clampé au max du
// plan Vercel). Fluid Compute autorise des durées longues.
export const maxDuration = 300;

const CHANNEL_STATUS: Record<string, { label: string; cls: string }> = {
  connected: { label: "Connecté", cls: "bg-(--green-50) text-(--green-600)" },
  pending: { label: "En attente", cls: "bg-(--amber-50) text-(--amber-800)" },
  error: { label: "Erreur", cls: "bg-(--red-50) text-(--red-600)" },
  disabled: {
    label: "Désactivé",
    cls: "bg-(--surface-2) text-(--text-tertiary)",
  },
};

// Réglages (M9.12, Direction B) — hero violet + SegTabs Profil / Canaux /
// Préférences. Profil + Canaux fonctionnels (lecture) ; Préférences en coquille
// (pas de modèle de préférences côté Account en V1).
//
// PERF (M9.19, point 2) : le hero s'affiche instantanément ; les onglets
// (compte + canaux) streament dans un <Suspense>.

async function ParametresTabs() {
  const account = await requireAccount();
  const db = await getTenantDb();
  const [channels, contacts] = await Promise.all([
    db.channel.findMany({
      orderBy: { createdAt: "asc" },
      include: { config: { select: { status: true, lastSyncAt: true } } },
    }),
    cachedContacts(account.id),
  ]);

  return (
    <FeedTabs
      options={[
        { value: "profil", label: "Profil" },
        { value: "canaux", label: "Canaux" },
        { value: "contacts", label: "Contacts" },
        { value: "preferences", label: "Préférences" },
      ]}
      panes={{
        profil: (
          <div className="space-y-5 px-4 pt-5">
            <Card>
              <CardHeader>
                <CardTitle>Informations personnelles</CardTitle>
                <CardDescription>
                  Modifiez votre nom et votre adresse email.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ProfileForm
                  defaultValues={{
                    firstName: account.firstName,
                    lastName: account.lastName,
                    email: account.email,
                  }}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Mot de passe</CardTitle>
                <CardDescription>
                  {account.passwordHash
                    ? "Changez votre mot de passe."
                    : "Définissez un mot de passe pour vous connecter sans Google."}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <PasswordForm hasPassword={Boolean(account.passwordHash)} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Session</CardTitle>
                <CardDescription>
                  Connecté en tant que {account.email}.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <form action={logoutAction}>
                  <Button
                    type="submit"
                    variant="outline"
                    className="w-full border-(--red-200) text-(--red-600) hover:bg-(--red-50) hover:text-(--red-600)"
                  >
                    <LogOut className="size-4" />
                    Se déconnecter
                  </Button>
                </form>
                {account.email === DEMO_EMAIL ? <ResetDemoButton /> : null}
              </CardContent>
            </Card>
          </div>
        ),
        canaux: (
          <div className="px-4 pt-5">
            <div className="overflow-hidden rounded-2xl border border-(--border-light) bg-white shadow-(--shadow-card)">
              {channels.length === 0 ? (
                <p className="p-5 text-center text-[13.5px] text-(--text-tertiary)">
                  Aucun canal connecté.
                </p>
              ) : (
                channels.map((ch, i) => {
                  const st =
                    CHANNEL_STATUS[ch.config?.status ?? "pending"] ??
                    CHANNEL_STATUS.pending;
                  const Icon = ch.type === "whatsapp" ? MessageCircle : Mail;
                  return (
                    <div
                      key={ch.id}
                      className={`flex items-center gap-3 px-4 py-3.5 ${i > 0 ? "border-t border-(--border-light)" : ""}`}
                    >
                      <span className="grid size-9 flex-none place-items-center rounded-xl bg-(--surface-2) text-(--text-secondary)">
                        <Icon className="size-[18px]" strokeWidth={2} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="text-[14.5px] font-semibold">
                          {ch.name}
                        </div>
                        <div className="truncate text-[12.5px] text-(--text-tertiary)">
                          {ch.identifier}
                        </div>
                      </div>
                      <span
                        className={`flex-none rounded-full px-2.5 py-1 text-[11px] font-bold ${st.cls}`}
                      >
                        {st.label}
                      </span>
                      <ChannelDeleteButton
                        channelId={ch.id}
                        channelName={ch.name}
                      />
                    </div>
                  );
                })
              )}
            </div>
            <ConnectEmailButton />
          </div>
        ),
        contacts: <ContactsPane contacts={contacts} />,
        preferences: (
          <div className="px-4 pt-5">
            <PreferencesToggles />
          </div>
        ),
      }}
    />
  );
}

export default function ParametresPage() {
  return (
    <Screen>
      <RelvoHeader
        title="Réglages"
        subtitle="Compte, canaux, contacts, préférences"
        className="pb-[34px]"
      />
      <Suspense fallback={<TabsSkeleton rows={3} />}>
        <ParametresTabs />
      </Suspense>
    </Screen>
  );
}
