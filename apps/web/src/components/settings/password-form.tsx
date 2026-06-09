"use client";

import { useActionState, useEffect, useRef } from "react";
import { toast } from "sonner";
import {
  FieldError,
  FormBanner,
  SubmitButton,
} from "@/components/auth/form-bits";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { initialFormState } from "@/lib/form";
import { changePasswordAction } from "@/server/actions/profile";

export function PasswordForm({ hasPassword }: { hasPassword: boolean }) {
  const [state, formAction] = useActionState(
    changePasswordAction,
    initialFormState,
  );
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.status === "success") {
      if (state.message) toast.success(state.message);
      formRef.current?.reset();
    }
  }, [state]);

  return (
    <form ref={formRef} action={formAction} className="space-y-4">
      <FormBanner
        status={state.status}
        message={state.status === "error" ? state.message : undefined}
      />

      {/* Compte Google-only : pas de mot de passe actuel à confirmer. */}
      <div className="space-y-1.5">
        <Label htmlFor="currentPassword">
          {hasPassword ? "Mot de passe actuel" : "Mot de passe actuel (aucun)"}
        </Label>
        <Input
          id="currentPassword"
          name="currentPassword"
          type="password"
          autoComplete="current-password"
          disabled={!hasPassword}
          required={hasPassword}
        />
        <FieldError messages={state.fieldErrors?.currentPassword} />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="newPassword">Nouveau mot de passe</Label>
        <Input
          id="newPassword"
          name="newPassword"
          type="password"
          autoComplete="new-password"
          required
        />
        <FieldError messages={state.fieldErrors?.newPassword} />
      </div>

      <SubmitButton>
        {hasPassword ? "Changer le mot de passe" : "Définir un mot de passe"}
      </SubmitButton>
    </form>
  );
}
