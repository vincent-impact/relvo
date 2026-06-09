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
import { loginAction } from "@/server/actions/auth";

export function LoginForm() {
  const [state, formAction] = useActionState(loginAction, initialFormState);

  return (
    <form action={formAction} className="space-y-4">
      <FormBanner status={state.status} message={state.message} />

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
        <div className="flex items-center justify-between">
          <Label htmlFor="password">Mot de passe</Label>
          <Link
            href="/mot-de-passe-oublie"
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            Oublié ?
          </Link>
        </div>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
        />
        <FieldError messages={state.fieldErrors?.password} />
      </div>

      <SubmitButton className="w-full">Se connecter</SubmitButton>
    </form>
  );
}
