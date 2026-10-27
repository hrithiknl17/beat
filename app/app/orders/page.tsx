"use client";

import { useMemo, useState } from "react";
import { FileText, Search } from "lucide-react";
import { useBeat } from "@/components/data";
import { Empty, Loading, OrderSlip, PageHead, Tabs } from "@/components/ui";

type Filter = "open" | "new" | "packed" | "dispatched" | "delivered" | "cancelled" | "all";
const NEXT: Record<string, { status: string; label: string }> = {
  new: { status: "packed", label: "Mark packed" },
  packed: { status: "dispatched", label: "Send for delivery" },
};

export default function Orders() {
  const { data, act, notify } = useBeat();
  const [filter, setFilter] = useState<Filter>("open");
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState<number | null>(null);

  const list = useMemo(() => {
    const s = query.trim().toLowerCase();
    return (data?.orders ?? []).filter((o) =>
      (filter === "all" || (filter === "open" ? ["new", "packed", "dispatched"].includes(o.status) : o.status === filter)) &&
      (!s || `${o.shop_name} ${o.area} B-${1000 + o.id}`.toLowerCase().includes(s)));
  }, [data, filter, query]);

  if (!data) return <Loading />;
  const count = (st: string[]) => data.orders.filter((o) => st.includes(o.status)).length;

  async function move(id: number, status: string, paid_by?: string) {
    if (status === "cancelled" && !window.confirm("Cancel this order? The shop won't get this delivery.")) return;
    setBusy(id);
    const ok = await act(`/api/orders/${id}`, "PATCH", { status, paid_by });
    setBusy(null);
    if (ok) notify(status === "delivered" ? (paid_by === "credit" ? "Delivered. Added to the shop's credit." : "Delivered. Cash collected.") : `Order ${status}.`);
  }

  return (
    <>
      <PageHead title="Orders" sub="Every order from calls and your salesman. Move each one from packing to delivery." />
      <div className="toolbar">
        <Tabs value={filter} onChange={setFilter} options={[
          { value: "open", label: "To deliver", count: count(["new", "packed", "dispatched"]) },
          { value: "new", label: "New", count: count(["new"]) },
          { value: "packed", label: "Packed", count: count(["packed"]) },
          { value: "dispatched", label: "Out for delivery", count: count(["dispatched"]) },
          { value: "delivered", label: "Delivered", count: count(["delivered"]) },
          { value: "cancelled", label: "Cancelled", count: count(["cancelled"]) },
          { value: "all", label: "All", count: data.orders.length },
        ]} />
        <div className="search-box"><Search /><input placeholder="Shop or order no." aria-label="Search orders" value={query} onChange={(e) => setQuery(e.target.value)} /></div>
      </div>

      {list.length === 0 ? (
        <Empty icon={<FileText />} title={data.orders.length ? "Nothing here" : "No orders yet"}>
          <p>{data.orders.length ? "Try another tab." : "Orders appear the moment a shop confirms on a call."}</p>
        </Empty>
      ) : (
        <section className="orders-grid wide">
          {list.map((o) => (
            <OrderSlip key={o.id} order={o} delivery={data.me.delivery_note}>
              {NEXT[o.status] && <button className="button secondary small" disabled={busy === o.id} onClick={() => move(o.id, NEXT[o.status].status)}>{NEXT[o.status].label}</button>}
              {o.status === "dispatched" && (
                <>
                  <button className="button primary small" disabled={busy === o.id} onClick={() => move(o.id, "delivered", "cash")}>Delivered · cash</button>
                  <button className="button secondary small" disabled={busy === o.id} onClick={() => move(o.id, "delivered", "credit")}>Delivered · credit</button>
                </>
              )}
              {["new", "packed", "dispatched"].includes(o.status) && <button className="text-button danger" disabled={busy === o.id} onClick={() => move(o.id, "cancelled")}>Cancel</button>}
            </OrderSlip>
          ))}
        </section>
      )}
    </>
  );
}
