import Link from "next/link";
import { Plus, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

// Instructions d'un domaine (M9.20) — consignes que Relvo applique. La carte
// montre le titre + un aperçu (3 lignes) et mène à une PAGE dédiée
// (/dossiers/[id]/instructions/[noteId]) pour lire en entier, modifier et
// activer/désactiver. V1 : seul l'utilisateur édite (invariant n°20).

export type Instruction = {
  id: string;
  name: string;
  content: string | null;
  active: boolean;
};

export function InstructionList({
  folderId,
  notes,
}: {
  folderId: string;
  notes: Instruction[];
}) {
  return (
    <div className="px-4 pt-4">
      {notes.length === 0 ? (
        <p className="py-6 text-center text-[13.5px] text-(--text-tertiary)">
          Aucune instruction. Ajoutez des consignes que Relvo suivra.
        </p>
      ) : (
        <div className="space-y-2.5">
          {notes.map((n) => (
            <Link
              key={n.id}
              href={`/dossiers/${folderId}/instructions/${n.id}`}
              className="block w-full rounded-2xl border border-(--border-light) bg-white p-3.5 shadow-(--shadow-card) transition active:scale-[0.99]"
            >
              <div className="mb-1.5 flex items-center gap-2">
                <Sparkles
                  className={cn(
                    "size-3.5 flex-none",
                    n.active ? "text-relvo" : "text-(--text-tertiary)",
                  )}
                  fill="currentColor"
                  strokeWidth={0}
                />
                <span className="flex-1 truncate text-[14.5px] font-bold">
                  {n.name}
                </span>
                {!n.active ? (
                  <span className="flex-none rounded-full bg-(--surface-2) px-2 py-0.5 text-[10.5px] font-bold text-(--text-tertiary)">
                    Désactivée
                  </span>
                ) : null}
              </div>
              {n.content ? (
                <p
                  className={cn(
                    "line-clamp-3 text-[13.5px] leading-[1.45] whitespace-pre-wrap",
                    n.active
                      ? "text-(--text-secondary)"
                      : "text-(--text-tertiary)",
                  )}
                >
                  {n.content}
                </p>
              ) : (
                <p className="text-[13px] text-(--text-tertiary) italic">
                  (Vide)
                </p>
              )}
            </Link>
          ))}
        </div>
      )}

      <Link
        href={`/dossiers/${folderId}/instructions/nouveau`}
        className="mt-3 flex w-full items-center gap-2.5 rounded-2xl border border-dashed border-(--border) px-3.5 py-3.5 text-[13.5px] font-semibold text-(--text-secondary)"
      >
        <span className="grid size-6 flex-none place-items-center rounded-full bg-(--surface-2)">
          <Plus className="size-[15px]" strokeWidth={2.4} />
        </span>
        Ajouter une instruction
      </Link>
    </div>
  );
}
