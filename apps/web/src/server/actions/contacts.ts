"use server";

import {
  type CreateContactInput,
  type UpdateContactInput,
  completeContact,
  createContact,
  deleteContact,
  updateContact,
} from "@relvo/db";
import { revalidatePath } from "next/cache";
import { domainAction } from "@/lib/action-result";
import { revalidateTenantData } from "@/server/cached";

// Server Actions Contacts (M3.5).

function revalidateContacts() {
  revalidatePath("/contacts");
  revalidatePath("/contacts/[id]", "page");
  revalidateTenantData();
}

export async function createContactAction(input: CreateContactInput) {
  const result = await domainAction((db) => createContact(db, input));
  if (result.ok) revalidateContacts();
  return result;
}

export async function updateContactAction(
  id: string,
  input: UpdateContactInput,
) {
  const result = await domainAction((db) => updateContact(db, id, input));
  if (result.ok) revalidateContacts();
  return result;
}

export async function completeContactAction(
  id: string,
  input?: UpdateContactInput,
) {
  const result = await domainAction((db) => completeContact(db, id, input));
  if (result.ok) revalidateContacts();
  return result;
}

export async function deleteContactAction(id: string) {
  const result = await domainAction((db) => deleteContact(db, id));
  if (result.ok) revalidateContacts();
  return result;
}
