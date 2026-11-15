import { Suspense } from "react";
import { PollRefresh } from "@/components/shared/poll-refresh";
import Link from "next/link";
import { cookies } from "next/headers";
import { Plus } from "lucide-react";
import { PROFONDEUR_MAX } from "@relvo/db";
import { BoutonAjoutCiel } from "@/components/feed/bouton-ajout-ciel";
import { FeedView, type VueSujets } from "@/components/feed/feed-view";
import { HeaderSwitch } from "@/components/layout/header-switch";
import { RelvoHeader, SKY_BTN } from "@/components/layout/relvo-header";
import { Screen } from "@/components/layout/screen";
import {
  IndicatorTabsSkeleton,
  RowsSkeleton,
} from "@/components/shared/screen-skeletons";
import {
  cachedChannelCount,
  cachedFilFeed,
  cachedFolders,
} from "@/server/cached";
import { requireAccountId } from "@/server/auth-context";

// Sujets — UNE page, DEUX VUES (M28.1 ; `ecarts`, « Sujets : une page, deux
// vues ») : l'interrupteur du ciel choisit entre « Sujets », la liste à plat,
// et « Dossiers », l'arbre complet, dossiers et sujets ensemble. La carte des
// INDICATEURS chevauche le ciel et agit sur les deux vues. Le « + » crée ce
// que la vue montre : un sujet, ou un dossier de premier niveau. Pas de loupe :
// la recherche est dans le menu, et la rangée du ciel n'a pas la place.
//
// Le choix de vue se RETIENT sur l'appareil (cookie posé par l'interrupteur) :
// l'URL a la main quand elle le porte (`?vue=`), sinon le cookie, sinon
// Dossiers — la première visite montre l'arbre.
//
// PERF (M9.19) : hero instantané ; liste + onglets streamés (<Suspense>), servis
// depuis le cache serveur en formes plates.

const COOKIE_VUE = "relvo-vue-sujets";

function lireVue(brut: string | undefined): VueSujets | null {
  return brut === "sujets" || brut === "dossiers" ? brut : null;
}

async function FilFeed({
  accountId,
  vue,
}: {
  accountId: string;
  vue: VueSujets;
}) {
  const [{ ouverts, valides, fermes }, folders, channels] = await Promise.all([
    cachedFilFeed(accountId),
    cachedFolders(accountId),
    cachedChannelCount(accountId),
  ]);

  return (
    <div className="apparait">
      <FeedView
        vue={vue}
        ouverts={ouverts}
        valides={valides}
        fermes={fermes}
        folders={folders}
        profondeurMax={PROFONDEUR_MAX}
        hasChannels={channels > 0}
      />
    </div>
  );
}

export default async function FilPage({
  searchParams,
}: {
  searchParams: Promise<{ vue?: string }>;
}) {
  const accountId = await requireAccountId();
  const [{ vue: demandee }, jar] = await Promise.all([searchParams, cookies()]);
  const vue =
    lireVue(demandee) ?? lireVue(jar.get(COOKIE_VUE)?.value) ?? "dossiers";

  return (
    <Screen>
      <PollRefresh />
      <RelvoHeader
        title="Sujets"
        className="pb-[46px]"
        action={
          <>
            <HeaderSwitch
              value={vue}
              retenir={COOKIE_VUE}
              items={[
                { value: "sujets", label: "Sujets", href: "/fil?vue=sujets" },
                {
                  value: "dossiers",
                  label: "Dossiers",
                  href: "/fil?vue=dossiers",
                },
              ]}
            />
            {vue === "dossiers" ? (
              <BoutonAjoutCiel />
            ) : (
              <Link
                href="/sujets/nouveau"
                aria-label="Nouveau sujet"
                className={SKY_BTN}
              >
                <Plus className="size-4" strokeWidth={2.6} />
              </Link>
            )}
          </>
        }
      />

      {/* Le squelette a la silhouette du rendu : la carte d'indicateurs qui
          chevauche le ciel, puis une carte de lignes. */}
      <Suspense
        fallback={
          <>
            <IndicatorTabsSkeleton />
            <RowsSkeleton count={8} className="mt-[86px]" />
          </>
        }
      >
        <FilFeed accountId={accountId} vue={vue} />
      </Suspense>
    </Screen>
  );
}
