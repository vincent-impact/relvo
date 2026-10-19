"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  adminSetAssistantAction,
  adminSetTestAction,
} from "@/server/actions/admin";
import type { CompteAdminVue } from "./format";

// Les deux interrupteurs du backoffice sur un compte (M21.4) : l'assistant —
// la méthode du domaine que l'utilisateur actionne lui-même dans ses
// Préférences, ici avec l'acteur `system` et un motif — et la marque « test ».
// Même carte, même grammaire que les Préférences : une ligne, un interrupteur.

const LIGNE = "flex items-center gap-3 px-4 py-3.5";

export function AccountGestes({ compte }: { compte: CompteAdminVue }) {
  const [assistant, setAssistant] = useState(compte.assistantEnabled);
  const [test, setTest] = useState(compte.isTest);
  const [motif, setMotif] = useState("");
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function toggleAssistant(next: boolean) {
    const previous = assistant;
    setAssistant(next);
    startTransition(async () => {
      const res = await adminSetAssistantAction(compte.id, next, motif);
      if (!res.ok) {
        setAssistant(previous);
        toast.error(res.message);
        return;
      }
      setMotif("");
      toast.success(next ? "Assistant rétabli." : "Assistant coupé.");
      router.refresh();
    });
  }

  function toggleTest(next: boolean) {
    const previous = test;
    setTest(next);
    startTransition(async () => {
      const res = await adminSetTestAction(compte.id, next);
      if (!res.ok) {
        setTest(previous);
        toast.error(res.message);
        return;
      }
      toast.success(next ? "Compte marqué « test »." : "Marque retirée.");
      router.refresh();
    });
  }

  return (
    <div className="mx-4 overflow-hidden rounded-(--rayon-carte) border border-(--filet) bg-white shadow-carte">
      <label className={`${LIGNE} cursor-pointer border-b border-(--filet)`}>
        <div className="min-w-0 flex-1">
          <div className="text-[14.5px] font-normal text-noir">
            Assistant Relvo
          </div>
          <div className="mt-0.5 text-[13px] leading-[18px] font-light text-gris">
            Coupé, Relvo ne lit plus rien de lui-même sur ce compte. Le motif
            part dans le journal.
          </div>
        </div>
        <Switch
          size="lg"
          checked={assistant}
          disabled={pending}
          onCheckedChange={toggleAssistant}
          aria-label="Assistant Relvo"
        />
      </label>
      <div className="border-b border-(--filet) px-4 py-3">
        <Input
          value={motif}
          onChange={(e) => setMotif(e.target.value)}
          placeholder="Motif (facultatif) — ex. coût anormal"
          aria-label="Motif"
          maxLength={200}
          className="h-10 text-[14px]"
        />
      </div>
      <label className={`${LIGNE} cursor-pointer`}>
        <div className="min-w-0 flex-1">
          <div className="text-[14.5px] font-normal text-noir">Compte test</div>
          <div className="mt-0.5 text-[13px] leading-[18px] font-light text-gris">
            Une étiquette pour distinguer les essais des vrais comptes. Ne
            change rien au produit.
          </div>
        </div>
        <Switch
          size="lg"
          checked={test}
          disabled={pending}
          onCheckedChange={toggleTest}
          aria-label="Compte test"
        />
      </label>
    </div>
  );
}
