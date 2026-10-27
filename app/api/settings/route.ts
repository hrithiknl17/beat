import { NextResponse, type NextRequest } from "next/server";
import { one } from "@/lib/db";
import { currentDistributor, DISTRIBUTOR_COLUMNS, type Distributor } from "@/lib/auth";
import { bad, body, phone10, signedOut } from "@/lib/http";

export const dynamic = "force-dynamic";

/** Update the business profile the agent uses. Body: any of name, owner_name, city, phone_number, delivery_note. */
export async function PATCH(req: NextRequest) {
  const me = await currentDistributor();
  if (!me) return signedOut();
  const b = await body<Record<string, string>>(req);

  const name = b.name !== undefined ? String(b.name).trim() : me.name;
  const owner = b.owner_name !== undefined ? String(b.owner_name).trim() : me.owner_name;
  const city = b.city !== undefined ? String(b.city).trim() : me.city;
  const note = b.delivery_note !== undefined ? String(b.delivery_note).trim() : me.delivery_note;
  let phone = me.phone_number;
  if (b.phone_number !== undefined) {
    phone = String(b.phone_number).trim() ? phone10(b.phone_number) : null;
    if (String(b.phone_number).trim() && !phone) return bad("Enter the Beat number as a 10-digit mobile number.");
  }
  if (name.length < 2) return bad("Enter your business name.");
  if (owner.length < 2) return bad("Enter your name.");
  if (note.length < 5) return bad("Tell shops when delivery comes, e.g. \"Tomorrow before 11 AM\".");

  try {
    const d = await one<Distributor>(
      `update distributors d set name = $2, owner_name = $3, city = $4, phone_number = $5, delivery_note = $6
        where id = $1 returning ${DISTRIBUTOR_COLUMNS}`,
      [me.id, name.slice(0, 80), owner.slice(0, 60), city.slice(0, 60) || "Bengaluru", phone, note.slice(0, 160)],
    );
    return NextResponse.json({ me: d });
  } catch {
    return bad("That Beat number is already linked to another account.", 409);
  }
}
