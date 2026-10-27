"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus } from "lucide-react";
import { toast } from "sonner";
import { deposerConnaissanceAction } from "@/server/actions/knowledge";

// « Ajouter une connaissance » (M27.5) — la première ligne de l'onglet
// Connaissances d'un dossier, la même grammaire d'ajout que les autres onglets.
// Le fichier part du navigateur VERS LE STOCKAGE, en direct (invariant 19 ; une
// Function plafonne son corps à 4,5 Mo) : on demande une URL signée à
// `api/uploads`, on y envoie l'octet, puis on inscrit la connaissance dans le
// dossier, à lire par Relvo. Ce que Relvo accepte ici : PDF, images, texte —
// le serveur le dit en cas de refus.

const ACCEPT =
  "application/pdf,image/jpeg,image/png,image/webp,text/plain,text/markdown";

export function DeposerConnaissance({ folderId }: { folderId: string }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [envoi, setEnvoi] = useState<string | null>(null);

  async function deposer(file: File) {
    setEnvoi(file.name);
    try {
      const contentType = file.type || "application/octet-stream";
      const demande = await fetch("/api/uploads", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          scope: "knowledge",
          contentType,
          contentLength: file.size,
        }),
      });
      if (!demande.ok) {
        const body = (await demande.json().catch(() => null)) as {
          error?: string;
        } | null;
        toast.error(body?.error ?? "Fichier refusé.");
        return;
      }
      const { url, key, requiredHeaders } = (await demande.json()) as {
        url: string;
        key: string;
        requiredHeaders: Record<string, string>;
      };
      const envoye = await fetch(url, {
        method: "PUT",
        headers: requiredHeaders,
        body: file,
      });
      if (!envoye.ok) {
        toast.error("L’envoi a échoué. Réessayez.");
        return;
      }
      const res = await deposerConnaissanceAction({
        folderId,
        name: file.name,
        mimeType: contentType,
        storageKey: key,
        fileSize: file.size,
      });
      if (!res.ok) {
        toast.error(res.message);
        return;
      }
      toast.success(`« ${file.name} » déposé. Relvo le lira.`);
      router.refresh();
    } catch {
      toast.error("L’envoi a échoué. Vérifiez votre connexion.");
    } finally {
      setEnvoi(null);
      if (input.current) input.current.value = "";
    }
  }

  return (
    <>
      <button
        type="button"
        disabled={envoi != null}
        onClick={() => input.current?.click()}
        className="flex w-full items-center gap-2.5 border-b border-(--filet) px-3.5 py-3 text-left text-[14px] font-medium text-relvo active:bg-relvo-pale disabled:opacity-70"
      >
        <span className="grid size-6 flex-none place-items-center rounded-full bg-relvo-pale">
          {envoi ? (
            <Loader2 className="size-[15px] animate-spin" strokeWidth={2.4} />
          ) : (
            <Plus className="size-[15px]" strokeWidth={2.4} />
          )}
        </span>
        <span className="min-w-0 flex-1 truncate">
          {envoi ? `Envoi de ${envoi}…` : "Ajouter une connaissance"}
        </span>
      </button>
      <input
        ref={input}
        type="file"
        accept={ACCEPT}
        className="sr-only"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void deposer(file);
        }}
      />
    </>
  );
}
