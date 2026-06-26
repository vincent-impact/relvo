"use client";

import { Loader2Icon } from "lucide-react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// Bouton de soumission qui reflète l'état `pending` du formulaire parent
// (React 19 useFormStatus). À utiliser à l'intérieur d'un <form action={…}>.
export function SubmitButton({
  children,
  className,
  variant,
}: {
  children: React.ReactNode;
  className?: string;
  variant?: React.ComponentProps<typeof Button>["variant"];
}) {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      disabled={pending}
      variant={variant}
      className={cn(
        // Tunnel auth « Direction B » : bouton primaire violet (couleur de
        // marque), sauf variante explicite (ex. Google → outline).
        !variant && "bg-relvo text-white hover:bg-relvo/90",
        className,
      )}
    >
      {pending && <Loader2Icon className="animate-spin" />}
      {children}
    </Button>
  );
}

/** Affiche la première erreur Zod d'un champ, le cas échéant. */
export function FieldError({ messages }: { messages?: string[] }) {
  if (!messages?.length) return null;
  return <p className="text-sm text-destructive">{messages[0]}</p>;
}

/** Bandeau de message global d'un formulaire (erreur ou succès). */
export function FormBanner({
  status,
  message,
}: {
  status: "idle" | "error" | "success";
  message?: string;
}) {
  if (!message || status === "idle") return null;
  return (
    <div
      role="alert"
      className={cn(
        "rounded-lg border px-3 py-2 text-sm",
        status === "error"
          ? "border-destructive/30 bg-destructive/10 text-destructive"
          : "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
      )}
    >
      {message}
    </div>
  );
}
