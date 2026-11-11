import { PieceIcone } from "@/components/shared/piece-icone";
import { AttachmentViewer } from "@/components/shared/attachment-viewer";
import { cn } from "@/lib/utils";

// Aperçu d'une pièce jointe, partagé par le fil de conversation (MessageBubble)
// et le détail d'un message (MessageDetailView) — cohérent quel que soit le canal
// (email, WhatsApp). Deux rendus :
//   • IMAGE → MINIATURE inline (façon messagerie : la photo tient dans le fil),
//     clic = lightbox plein écran in-app (cf. AttachmentViewer) ;
//   • tout autre fichier → carte fichier (icône + nom + étiquette IA).
// Le geste d'ouverture — visionneuse, lecteur de PDF, aperçu d'un classeur,
// écran du fichier — est délégué à AttachmentViewer, qui le choisit au type.

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
          // Sous-carte dans un message : filet, pas d'ombre (pas de carte dans
          // une carte avec deux ombres), rayon de sous-carte.
          "block w-fit max-w-full cursor-pointer overflow-hidden rounded-(--rayon-sous-carte) border border-(--filet)",
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
      <PieceIcone name={name} mimeType={mimeType} size="sm" />
      <span className="min-w-0">
        <span className="block truncate text-[13px] font-semibold">{name}</span>
        {/* Ce que Relvo a lu dans la pièce : un libellé gris, pas la couleur
            d'un acteur (l'ambre est Externe, et c'est Relvo qui a nommé). */}
        {label ? (
          <span className="mt-0.5 inline-block rounded-full bg-(--fond-puce) px-[7px] py-px text-[11px] font-medium text-gris">
            {label}
          </span>
        ) : null}
      </span>
    </>
  );
  const cardClass = cn(
    "inline-flex max-w-full items-center gap-2.5 rounded-(--rayon-sous-carte) border border-(--filet) bg-white px-[11px] py-2",
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

/**
 * Les pièces d'un message — TOUTES. Un e-mail en porte couramment plusieurs ;
 * n'en montrer qu'une, c'est en cacher trois, et la conversation est la seule
 * surface où elles se lisent. Images en vignettes, fichiers en cartes, dans
 * l'ordre d'arrivée, qui passent à la ligne.
 */
export function AttachmentList({
  attachments,
  className,
}: {
  attachments?: AttachmentPreviewData[] | null;
  className?: string;
}) {
  if (!attachments || attachments.length === 0) return null;
  return (
    <div className={cn("flex flex-wrap items-start gap-2", className)}>
      {attachments.map((a, i) => (
        <AttachmentPreview key={a.id ?? `${i}-${a.name}`} attachment={a} />
      ))}
    </div>
  );
}
