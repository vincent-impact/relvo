"use client";

import type { LucideIcon } from "lucide-react";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";

// ConfirmDialog — modale de confirmation centrale, RÉUTILISABLE (suppression,
// avertissement, action sensible). Bâtie sur le primitive shadcn AlertDialog
// (Base UI) et habillée Direction B. Contrôlée via `open` / `onOpenChange`.

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "Confirmer",
  cancelLabel = "Annuler",
  tone = "default",
  icon: Icon,
  pending = false,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  /** `destructive` : média + bouton rouges. `default` : violet Relvo. */
  tone?: "default" | "destructive";
  icon?: LucideIcon;
  pending?: boolean;
  onConfirm: () => void;
}) {
  const destructive = tone === "destructive";
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          {Icon ? (
            <AlertDialogMedia
              className={cn(
                destructive
                  ? "bg-(--red-50) text-(--red-600)"
                  : "bg-relvo-bg text-relvo",
              )}
            >
              <Icon strokeWidth={2} />
            </AlertDialogMedia>
          ) : null}
          <AlertDialogTitle>{title}</AlertDialogTitle>
          {description ? (
            <AlertDialogDescription>{description}</AlertDialogDescription>
          ) : null}
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>
            {cancelLabel}
          </AlertDialogCancel>
          <button
            type="button"
            onClick={onConfirm}
            disabled={pending}
            className={cn(
              "inline-flex h-10 items-center justify-center gap-1.5 rounded-4xl px-5 text-sm font-semibold text-white transition-colors disabled:opacity-60",
              destructive
                ? "bg-(--red-600) hover:bg-(--red-800)"
                : "bg-relvo hover:bg-relvo/90",
            )}
          >
            {Icon && destructive ? (
              <Icon className="size-4" strokeWidth={2.2} />
            ) : null}
            {confirmLabel}
          </button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
