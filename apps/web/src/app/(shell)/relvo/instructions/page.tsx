import type { Metadata } from "next";
import { getDefaultFolder } from "@relvo/db";
import { MobileFrame } from "@/components/layout/mobile-frame";
import { RelvoHeader } from "@/components/layout/relvo-header";
import { InstructionList } from "@/components/memoire/instruction-list";
import { getTenantDb, requireAccount } from "@/server/auth-context";

export const metadata: Metadata = { title: "Mes instructions — Relvo" };

// Les INSTRUCTIONS DE RELVO (M28.1) — les consignes qui valent PARTOUT, quel
// que soit le dossier. Elles se donnent à l'assistant, donc elles se lisent
// chez lui, à côté de l'historique des échanges. Rien ne change dans le
// modèle : ce sont les instructions du dossier « Général », la racine, que
// tout sujet hérite (invariants 16 et 17) ; cette page en est la porte. Seul
// le dirigeant les écrit (invariant 20) : pas de signe de Relvo ici.

export default async function RelvoInstructionsPage() {
  await requireAccount();
  const db = await getTenantDb();
  const general = await getDefaultFolder(db);
  const notes = general
    ? await db.knowledgeDocument.findMany({
        where: { folderId: general.id, kind: "note" },
        orderBy: { updatedAt: "desc" },
      })
    : [];

  return (
    <MobileFrame>
      <main className="entre-ecran min-h-0 flex-1 overflow-y-auto bg-background pb-8">
        <RelvoHeader back="/relvo" title="Mes instructions" />
        {general ? (
          <InstructionList
            folderId={general.id}
            notes={notes.map((n) => ({
              id: n.id,
              name: n.name,
              content: n.content,
              active: n.absorptionStatus === "read",
            }))}
            vide="Aucune instruction. Ce que vous écrivez ici, Relvo l’applique partout : à chaque sujet, dans chaque dossier."
          />
        ) : null}
      </main>
    </MobileFrame>
  );
}
