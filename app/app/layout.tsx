import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { currentDistributor } from "@/lib/auth";
import { Shell } from "@/components/Shell";

export const metadata: Metadata = { title: "Beat · Dashboard" };
export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const me = await currentDistributor();
  if (!me) redirect("/login");
  return <Shell me={me}>{children}</Shell>;
}
