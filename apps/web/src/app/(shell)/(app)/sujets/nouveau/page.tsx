import { RelvoHeader } from "@/components/layout/relvo-header";
import { SubjectDetailForm } from "@/components/subject/subject-detail-form";
import { contactFullName } from "@/lib/display";
import { listFolderOptions } from "@relvo/db";
import { getTenantDb } from "@/server/auth-context";

// Création manuelle d'un sujet (Direction B) — même set-up que l'onglet « Détail »
// d'une fiche, en mode `create`. Hero violet + formulaire ; à la création, on
// redirige vers la fiche du nouveau sujet.

export default async function NouveauSujetPage({
  searchParams,
}: {
  searchParams: Promise<{ dossier?: string }>;
}) {
  const { dossier } = await searchParams;
  const db = await getTenantDb();
  const [folders, contacts] = await Promise.all([
    listFolderOptions(db),
    db.contact.findMany({
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      select: { id: true, firstName: true, lastName: true, company: true },
    }),
  ]);
  const contactOptions = contacts.map((c) => ({
    id: c.id,
    name: contactFullName(c),
    company: c.company,
  }));

  // Venu de l'onglet Sujets d'un dossier (« Ajouter un sujet ici », M27.3) :
  // le dossier est pré-rempli, et le retour y ramène.
  const dans = dossier ? (folders.find((f) => f.id === dossier) ?? null) : null;

  return (
    <>
      <main className="entre-ecran min-h-0 flex-1 overflow-y-auto bg-background pb-[calc(92px+env(safe-area-inset-bottom))]">
        <RelvoHeader
          back={dans ? `/memoire/${dans.id}` : "/fil"}
          title="Nouveau sujet"
          subtitle={dans ? `Dans ${dans.path}` : "Paramétrez le sujet à suivre"}
          className="pb-9"
        />
        <SubjectDetailForm
          mode="create"
          folders={folders}
          contacts={contactOptions}
          initial={{
            title: "",
            status: "open",
            priority: "normal",
            folderId: dans?.id ?? null,
            contactIds: [],
          }}
        />
      </main>
    </>
  );
}
