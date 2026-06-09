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
import { signupAction } from "@/server/actions/auth";

export function SignupForm() {
  const [state, formAction] = useActionState(signupAction, initialFormState);

  return (
    <form action={formAction} className="space-y-4">
      <FormBanner status={state.status} message={state.message} />

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="firstName">Prénom</Label>
          <Input
            id="firstName"
            name="firstName"
            autoComplete="given-name"
            required
          />
          <FieldError messages={state.fieldErrors?.firstName} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="lastName">Nom</Label>
          <Input
            id="lastName"
            name="lastName"
            autoComplete="family-name"
            required
          />
          <FieldError messages={state.fieldErrors?.lastName} />
        </div>
      </div>

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

      <div className="space-y-1.5">
        <Label htmlFor="password">Mot de passe</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
        />
        <FieldError messages={state.fieldErrors?.password} />
      </div>

      <SubmitButton className="w-full">Créer mon compte</SubmitButton>
    </form>
  );
}
