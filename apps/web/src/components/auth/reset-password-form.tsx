"use client";

import Link from "next/link";
import { useActionState } from "react";
import {
  FieldError,
  FormBanner,
  SubmitButton,
} from "@/components/auth/form-bits";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { initialFormState } from "@/lib/form";
import { resetPasswordAction } from "@/server/actions/auth";

export function ResetPasswordForm({ token }: { token: string }) {
  const [state, formAction] = useActionState(
    resetPasswordAction,
    initialFormState,
  );

  if (state.status === "success") {
    return (
      <div className="space-y-4">
        <FormBanner status={state.status} message={state.message} />
        <Link
          href="/connexion"
          className="text-[13.5px] font-semibold text-relvo hover:underline"
        >
          Aller à la connexion
        </Link>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-4">
      <FormBanner status={state.status} message={state.message} />
      <input type="hidden" name="token" value={token} />

      <div className="space-y-1.5">
        <Label htmlFor="password">Nouveau mot de passe</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
        />
        <FieldError messages={state.fieldErrors?.password} />
      </div>

      <SubmitButton className="w-full">Réinitialiser</SubmitButton>
    </form>
  );
}
