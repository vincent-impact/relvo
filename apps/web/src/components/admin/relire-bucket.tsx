"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { adminRelireBucketAction } from "@/server/actions/admin";

// Relire le bucket chez le fournisseur sans attendre que la lecture gardée
// expire (M25.1) : après une purge ou un drainage, pour voir ce qui est parti.

export function RelireBucket() {
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  return (
    <Button
      type="button"
      size="sm"
      variant="outline"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const res = await adminRelireBucketAction();
          if (!res.ok) {
            toast.error(res.message);
            return;
          }
          router.refresh();
        })
      }
    >
      {pending ? "Lecture…" : "Relire le bucket"}
    </Button>
  );
}
