"use client";

import { useActionState, useEffect } from "react";
import { toast } from "sonner";
import {
  FieldError,
  FormBanner,
  SubmitButton,
} from "@/components/auth/form-bits";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { initialFormState } from "@/lib/form";
import { updateProfileAction } from "@/server/actions/profile";

export function ProfileForm({
  defaultValues,
}: {
  defaultValues: { firstName: string; lastName: string; email: string };
}) {
  const [state, formAction] = useActionState(
    updateProfileAction,
    initialFormState,
  );

  useEffect(() => {
    if (state.status === "success" && state.message)
      toast.success(state.message);
  }, [state]);

  return (
    <form action={formAction} className="space-y-4">
      <FormBanner
        status={state.status}
        message={state.status === "error" ? state.message : undefined}
      />

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="firstName">Prénom</Label>
          <Input
            id="firstName"
            name="firstName"
            defaultValue={defaultValues.firstName}
            required
          />
          <FieldError messages={state.fieldErrors?.firstName} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="lastName">Nom</Label>
          <Input
            id="lastName"
            name="lastName"
            defaultValue={defaultValues.lastName}
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
          defaultValue={defaultValues.email}
          required
        />
        <FieldError messages={state.fieldErrors?.email} />
      </div>

      <SubmitButton>Enregistrer</SubmitButton>
    </form>
  );
}
