import { FileText } from "lucide-react";
import { AttachmentViewer } from "@/components/shared/attachment-viewer";
import { cn } from "@/lib/utils";

// Aperçu d'une pièce jointe, partagé par le fil de conversation (MessageBubble)
// et le détail d'un message (MessageDetailView) — cohérent quel que soit le canal
// (email, WhatsApp). Deux rendus :
//   • IMAGE → MINIATURE inline (façon messagerie : la photo tient dans le fil),
//     clic = lightbox plein écran in-app (cf. AttachmentViewer) ;
//   • PDF / autre → carte fichier (icône + nom + étiquette IA), clic = navigateur.
// Le geste (lightbox vs navigateur) est délégué à AttachmentViewer.

export type AttachmentPreviewData = {
  id?: string;
  name: string;
  label?: string | null;
  mimeType?: string | null;
};

export function AttachmentPreview({
  attachment,
  className,
}: {
  attachment: AttachmentPreviewData;
  className?: string;
}) {
  const { id, name, label, mimeType } = attachment;
  const isImage = (mimeType ?? "").startsWith("image/");

  // Image + id → miniature. On charge l'image plein format redimensionnée par le
  // navigateur (pas de vignette serveur en V1) : les PJ restent petites.
  if (id && isImage) {
    return (
      <AttachmentViewer
        id={id}
        name={name}
        mimeType={mimeType}
        className={cn(
          "block w-fit max-w-full cursor-pointer overflow-hidden rounded-2xl border border-[#ececea] shadow-(--shadow-card)",
          className,
        )}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={`/api/attachments/${id}/download?inline=1`}
          alt={name}
          className="max-h-[260px] max-w-[240px] object-cover"
        />
      </AttachmentViewer>
    );
  }

  const card = (
    <>
      <span className="grid size-[30px] flex-none place-items-center rounded-lg bg-[#f0eeea] text-[#86857d]">
        <FileText className="size-4" strokeWidth={2} />
      </span>
      <span className="min-w-0">
        <span className="block truncate text-[13px] font-semibold">{name}</span>
        {label ? (
          <span className="mt-0.5 inline-block rounded-full bg-(--amber-50) px-[7px] py-px text-[11px] text-(--amber-800)">
            {label}
          </span>
        ) : null}
      </span>
    </>
  );
  const cardClass = cn(
    "inline-flex items-center gap-2.5 rounded-xl border border-[#ececea] bg-white px-[11px] py-2 shadow-(--shadow-card)",
    className,
  );

  return id ? (
    <AttachmentViewer
      id={id}
      name={name}
      mimeType={mimeType}
      className={cn(
        cardClass,
        "cursor-pointer text-left transition-colors hover:bg-(--surface-2)",
      )}
    >
      {card}
    </AttachmentViewer>
  ) : (
    <span className={cardClass}>{card}</span>
  );
}
