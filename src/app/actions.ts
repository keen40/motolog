"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { authMode } from "@/lib/auth";

export async function setLang(formData: FormData) {
  const lang = formData.get("lang") === "hu" ? "hu" : "en";
  (await cookies()).set("lang", lang, { path: "/", maxAge: 60 * 60 * 24 * 365 });
}

/** Dev mode only: switch between test users to try out sharing. */
export async function switchDevUser(formData: FormData) {
  if (authMode() !== "dev") return;
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (email) (await cookies()).set("dev_user", email, { path: "/" });
  redirect("/garage");
}
