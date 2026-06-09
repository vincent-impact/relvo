"use client";

import { useActionState } from "react";
import {
  FieldError,
  FormBanner,
  SubmitButton,
} from "@/components/auth/form-bits";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { initialFormState } from "@/lib/form";
import { requestPasswordResetAction } from "@/server/actions/auth";

export function ForgotPasswordForm() {
  const [state, formAction] = useActionState(
    requestPasswordResetAction,
    initialFormState,
  );

  return (
    <form action={formAction} className="space-y-4">
      <FormBanner status={state.status} message={state.message} />

      {state.status !== "success" && (
        <>
          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
            />
            <FieldError messages={state.fieldErrors?.email} />
          </div>
          <SubmitButton className="w-full">Envoyer le lien</SubmitButton>
        </>
      )}
    </form>
  );
}
