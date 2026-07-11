"use server";

import { revalidatePath } from "next/cache";

import { softDeleteTrainingExample } from "@/lib/attribution/training";
import { assertAdminSession } from "@/lib/auth/session";

export async function softDeleteTrainingExampleAction(formData: FormData) {
  const session = await assertAdminSession();
  const exampleId = String(formData.get("exampleId") ?? "");
  if (!exampleId) return;
  await softDeleteTrainingExample({
    organizationId: session.organizationId,
    exampleId,
  });
  revalidatePath("/settings/attribution");
}
