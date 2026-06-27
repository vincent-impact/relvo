import { MobileFrame } from "@/components/layout/mobile-frame";
import { RelvoHeader } from "@/components/layout/relvo-header";
import { SubjectDetailForm } from "@/components/subject/subject-detail-form";
import { contactFullName } from "@/lib/display";
import { getTenantDb } from "@/server/auth-context";

// Création manuelle d'un sujet (Direction B) — même set-up que l'onglet « Détail »
// d'une fiche, en mode `create`. Hero violet + formulaire ; à la création, on
// redirige vers la fiche du nouveau sujet.

export default async function NouveauSujetPage() {
  const db = await getTenantDb();
  const [folders, contacts] = await Promise.all([
    db.folder.findMany({
      orderBy: [{ isDefault: "desc" }, { name: "asc" }],
      select: { id: true, name: true, slug: true },
    }),
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

  return (
    <MobileFrame>
      <main className="min-h-0 flex-1 overflow-y-auto overscroll-contain bg-white">
        <RelvoHeader
          back="/fil"
          title="Nouveau sujet"
          subtitle="Paramétrez le sujet à suivre"
          className="pb-9"
        />
        <SubjectDetailForm
          mode="create"
          folders={folders}
          contacts={contactOptions}
          initial={{
            title: "",
            status: "new",
            priority: "normal",
            folderId: null,
            contactIds: [],
          }}
        />
      </main>
    </MobileFrame>
  );
}
