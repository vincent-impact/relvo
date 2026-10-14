import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { ChevronRight, Plus } from "lucide-react";
import { RelvoHeader, SKY_BTN } from "@/components/layout/relvo-header";
import { Screen } from "@/components/layout/screen";
import { InstructionList } from "@/components/memoire/instruction-list";
import { ListPanel } from "@/components/shared/list-panel";
import { RowsSkeleton } from "@/components/shared/screen-skeletons";
import { ZoneHeading } from "@/components/shared/zone-heading";
import { folderVisual } from "@/lib/folders";
import { cachedMemoire, type CachedFolderRow } from "@/server/cached";
import { getTenantDb, requireAccountId } from "@/server/auth-context";

export const metadata: Metadata = { title: "Mémoire — Relvo" };

// Mémoire — ce que Relvo sait de l'entreprise (01 §8), page du menu. Trois
// zones : les instructions du COMPTE en tête (celles du domaine « Général »,
// transversal : vous seul les écrivez, invariant 20), les domaines en lignes
// avec leur rail et ce qu'ils portent, et « Ce que Relvo a appris », réservée à
// M17 — c'est elle qui donnera à cette page une raison d'être visitée.

function plural(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n > 1 ? many : one}`;
}

function folderSub(f: CachedFolderRow): string {
  const parts = [
    plural(f.instructions, "instruction"),
    plural(f.documents, "document"),
  ];
  parts.push(
    f.isDefault
      ? "sans sujet, par nature"
      : `${plural(f.openSubjects, "sujet ouvert", "sujets ouverts")}`,
  );
  return parts.join(" · ");
}

async function MemoireBody({ accountId }: { accountId: string }) {
  const { defaultFolderId, folders } = await cachedMemoire(accountId);
  const db = await getTenantDb();
  const notes = defaultFolderId
    ? await db.knowledgeDocument.findMany({
        where: { folderId: defaultFolderId, kind: "note" },
        orderBy: { updatedAt: "desc" },
      })
    : [];

  return (
    <div className="space-y-5 pt-4">
      <section>
        <ZoneHeading
          label="Votre entreprise"
          hint={`${plural(notes.length, "instruction")} · vous seul les écrivez`}
        />
        {defaultFolderId ? (
          <InstructionList
            folderId={defaultFolderId}
            notes={notes.map((n) => ({
              id: n.id,
              name: n.name,
              content: n.content,
              active: n.absorptionStatus === "read",
            }))}
            className="px-4 pt-0"
          />
        ) : null}
      </section>

      <section>
        <ZoneHeading
          label="Par domaine"
          hint={plural(folders.length, "domaine")}
        />
        <ListPanel>
          {folders.map((f) => {
            const { color } = folderVisual({
              slug: f.slug,
              color: f.color,
              icon: f.icon,
            });
            return (
              <Link
                key={f.id}
                data-list-row
                href={`/memoire/${f.id}`}
                className="flex h-[58px] items-center gap-2.5 border-b border-(--filet) px-3.5 active:bg-(--fond-enfonce)"
              >
                <span
                  aria-hidden
                  className="bande-ligne"
                  style={{ background: color }}
                />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[14.5px] leading-[18px] font-normal text-noir">
                    {f.name}
                  </div>
                  <div className="truncate text-[12px] leading-[14px] font-light text-gris">
                    {folderSub(f)}
                  </div>
                </div>
                <ChevronRight
                  className="size-4 flex-none text-(--gris-clair)"
                  strokeWidth={2}
                />
              </Link>
            );
          })}
        </ListPanel>
      </section>

      <section>
        <ZoneHeading label="Ce que Relvo a appris" hint="bientôt" />
        <p className="mx-4 text-[13.5px] leading-[1.45] font-light text-gris">
          Relvo notera ici ce qu&apos;il a compris de vos habitudes en vous
          regardant trier, et vous pourrez le corriger d&apos;un geste. Rien de
          ce qu&apos;il apprend ici n&apos;est partagé avec un autre compte.
        </p>
      </section>
    </div>
  );
}

export default async function MemoirePage() {
  const accountId = await requireAccountId();
  return (
    <Screen>
      <RelvoHeader
        title="Mémoire"
        subtitle="Ce que Relvo sait de votre entreprise"
        className="pb-5"
        action={
          <Link
            href="/memoire/nouveau"
            aria-label="Nouveau domaine"
            className={SKY_BTN}
          >
            <Plus className="size-4" strokeWidth={2.6} />
          </Link>
        }
      />
      <Suspense fallback={<RowsSkeleton count={4} />}>
        <MemoireBody accountId={accountId} />
      </Suspense>
    </Screen>
  );
}
