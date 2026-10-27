import { NextResponse, type NextRequest } from "next/server";
import { currentDistributor } from "@/lib/auth";
import { bad, body, signedOut } from "@/lib/http";
import { loadSampleShops, loadStarterCatalog } from "@/lib/sample";

export const dynamic = "force-dynamic";

/** Day-one setup. Body: { load: "catalog" | "shops" }. Both skip anything already there. */
export async function POST(req: NextRequest) {
  const me = await currentDistributor();
  if (!me) return signedOut();
  const { load } = await body<{ load: string }>(req);
  if (load === "catalog") return NextResponse.json({ added: await loadStarterCatalog(me.id) });
  if (load === "shops") return NextResponse.json({ added: await loadSampleShops(me.id) });
  return bad("Nothing to load.");
}
