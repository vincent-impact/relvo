"use server";

import {
  type ChannelConfigInput,
  type CreateChannelInput,
  type UpdateChannelInput,
  createChannel,
  deleteChannel,
  updateChannel,
  upsertChannelConfig,
} from "@relvo/db";
import { revalidatePath } from "next/cache";
import { domainAction } from "@/lib/action-result";

// Server Actions Channels (M3.6) — onglet Paramètres → Canaux (M5/M6).

function revalidateChannels() {
  revalidatePath("/parametres");
}

export async function createChannelAction(input: CreateChannelInput) {
  const result = await domainAction((db) => createChannel(db, input));
  if (result.ok) revalidateChannels();
  return result;
}

export async function updateChannelAction(
  id: string,
  input: UpdateChannelInput,
) {
  const result = await domainAction((db) => updateChannel(db, id, input));
  if (result.ok) revalidateChannels();
  return result;
}

export async function deleteChannelAction(id: string) {
  const result = await domainAction((db) => deleteChannel(db, id));
  if (result.ok) revalidateChannels();
  return result;
}

export async function upsertChannelConfigAction(
  channelId: string,
  input: ChannelConfigInput,
) {
  const result = await domainAction((db) =>
    upsertChannelConfig(db, channelId, input),
  );
  if (result.ok) revalidateChannels();
  return result;
}
