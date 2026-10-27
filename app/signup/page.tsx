import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { currentDistributor } from "@/lib/auth";
import { AuthForm } from "@/components/AuthForm";

export const metadata: Metadata = { title: "Create account · Beat" };
export const dynamic = "force-dynamic";

export default async function SignupPage() {
  if (await currentDistributor()) redirect("/app");
  return <AuthForm mode="signup" />;
}
