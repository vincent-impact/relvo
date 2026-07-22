"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Sparkles } from "lucide-react";
import { toast } from "sonner";
import { SwipeRow } from "@/components/shared/swipe-row";
import { MessageBubble } from "@/components/shared/message-bubble";
import { createSubjectFromMessageAction } from "@/server/actions/messages";
import type { ThreadMessageData } from "@/lib/conversation-row";

// Message WhatsApp dans le fil (M6ter) — BULLE + swipe droite « ce message est
// important » : commence l'écoute ici et ouvre le sujet ; si une écoute existe
// déjà et que le message est plus ancien, elle REMONTE jusqu'à lui (un seul
// geste qui crée OU étend, géré côté domaine). Le TAP reste réservé aux pièces
// jointes (AttachmentPreview, à l'intérieur de la bulle).

export function WhatsAppMessageRow({ data }: { data: ThreadMessageData }) {
  const router = useRouter();
  const [, startTransition] = useTransition();

  function openFromMessage() {
    startTransition(async () => {
      const res = await createSubjectFromMessageAction(data.id);
      if (res.ok) {
        toast.success("Sujet ouvert sur ce fil");
        router.push(`/sujets/${res.data.id}?from=/conversations`);
      } else {
        toast.error(res.message);
      }
    });
  }

  return (
    <SwipeRow
      right={{
        onAct: openFromMessage,
        label: "Nouveau sujet",
        icon: Sparkles,
        tone: "brand",
      }}
    >
      <div className="flex flex-col px-[18px] py-[7px]">
        <MessageBubble
          data={{
            id: data.id,
            direction: data.direction,
            actor: data.direction === "outgoing" ? "user" : "contact",
            senderName: data.senderName,
            time: data.time,
            content: data.content,
            attachment: data.attachment,
          }}
        />
      </div>
    </SwipeRow>
  );
}
