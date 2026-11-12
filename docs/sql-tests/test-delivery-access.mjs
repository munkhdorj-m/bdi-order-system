// Tests who may open an order on the delivery screen
// (web/src/lib/delivery-runs.ts → loadDeliveryOrder): only the login linked
// to the run's delivery person, and nothing is said about anyone else's
// order beyond "not found".
//
// The database answer is canned here — the point is what the code does
// with it, not the query.
import { loadTs } from "./load-ts.mjs";

let failures = 0;
function check(name, cond, detail = "") {
  if (cond) console.log("  ok   " + name);
  else {
    failures++;
    console.log("  FAIL " + name + (detail ? "  -> " + detail : ""));
  }
}

const ME = "c0000000-0000-4000-8000-000000000009";
const SOMEONE = "c0000000-0000-4000-8000-000000000008";
const ORDER = "10000000-0000-4000-8000-000000000001";

/** A client whose every query resolves to `answer` and records the table asked. */
function canned(answer, asked = []) {
  const chain = new Proxy(
    {},
    {
      get(_t, prop) {
        if (prop === "then") return (resolve) => resolve(answer);
        return () => chain;
      },
    },
  );
  return {
    from(table) {
      asked.push(table);
      return chain;
    },
  };
}

const row = (over = {}) => ({
  id: ORDER,
  order_number: "ORD-2026-00001",
  status: "shipped",
  updated_at: "2026-11-12T03:00:00.000000+00:00",
  subtotal: 2600,
  discount_total: 52,
  payment_method: "cash",
  notes: null,
  placer: { role: "buyer" },
  shipment: { id: "s", shipment_no: 7, delivery_date: "2026-11-12", status: "closed", distributor: { profile_id: ME, active: true } },
  store: { name: "Дэлгүүр", address: "Хаяг", contact_phone: "99112233", district: " БЗД  ", lat: 47.9, lng: 106.9 },
  lines: [
    { id: "l2", product_id: "p2", name: "Я", qty: 1, unit_price: 800, product: { box_count: null } },
    { id: "l1", product_id: "p1", name: "А", qty: 2, unit_price: 900, product: { box_count: 24 } },
  ],
  ...over,
});

console.log("\n== Who may open an order on the delivery screen ==");
{
  const { loadDeliveryOrder } = loadTs("lib/delivery-runs.ts");
  const open = async (answer, user = ME, id = ORDER) => {
    const asked = [];
    globalThis.__bdiAdmin = canned(answer, asked);
    return { r: await loadDeliveryOrder(id, user), asked };
  };

  let { r } = await open({ data: row(), error: null });
  check("the run's own delivery person gets the order", !!r.order && r.order.id === ORDER, JSON.stringify(r));
  check(
    "...with what the screen needs (lines by name, money as numbers, a tidy district)",
    r.order?.lines[0].name === "А" && r.order.lines[0].box_count === 24 && r.order.discount_total === 52 && r.order.store.district === "БЗД" && r.order.hasDeals === true,
    JSON.stringify(r.order),
  );

  ({ r } = await open({ data: row(), error: null }, SOMEONE));
  check("another delivery person gets 'not found'", r.error === "Захиалга олдсонгүй.", JSON.stringify(r));

  ({ r } = await open({ data: row({ shipment: null }), error: null }));
  check("an order that is on no run: not found", r.error === "Захиалга олдсонгүй.", JSON.stringify(r));

  ({ r } = await open({ data: row({ shipment: { ...row().shipment, distributor: null } }), error: null }));
  check("a run without a delivery person: not found", r.error === "Захиалга олдсонгүй.", JSON.stringify(r));

  ({ r } = await open({ data: row({ shipment: { ...row().shipment, distributor: { profile_id: null, active: true } } }), error: null }, ME));
  check("a delivery person with no login linked: not found", r.error === "Захиалга олдсонгүй.", JSON.stringify(r));

  ({ r } = await open({ data: row({ shipment: { ...row().shipment, distributor: { profile_id: ME, active: false } } }), error: null }));
  check("a switched-off delivery person: not found", r.error === "Захиалга олдсонгүй.", JSON.stringify(r));

  ({ r } = await open({ data: null, error: null }));
  check("no such order: not found", r.error === "Захиалга олдсонгүй.", JSON.stringify(r));

  let asked;
  ({ r, asked } = await open({ data: row(), error: null }, ME, "not-an-id"));
  check("a made-up id is refused without asking the database", r.error === "Захиалга олдсонгүй." && asked.length === 0, JSON.stringify({ r, asked }));

  ({ r } = await open({ data: null, error: { code: "42703", message: "column distributors_1.profile_id does not exist" } }));
  check("before fix 43 it says the screen isn't switched on yet (no database text)", !!r.error && !/column|profile_id/.test(r.error), JSON.stringify(r));
}

console.log("\n== Which login is a delivery person ==");
{
  const { myDistributor } = loadTs("lib/delivery-runs.ts");
  globalThis.__bdiAdmin = canned({ data: { id: "d1", name: "Мөнхөө" }, error: null });
  let r = await myDistributor(ME);
  check("a linked login is recognised", r.distributor?.name === "Мөнхөө" && r.setup === false, JSON.stringify(r));
  globalThis.__bdiAdmin = canned({ data: null, error: null });
  r = await myDistributor(ME);
  check("an unlinked login is not", r.distributor === null && r.setup === false, JSON.stringify(r));
  globalThis.__bdiAdmin = canned({ data: null, error: { code: "42703", message: "column distributors.profile_id does not exist" } });
  r = await myDistributor(ME);
  check("before fix 43: not a delivery person, and flagged as 'not set up yet'", r.distributor === null && r.setup === true, JSON.stringify(r));
}

console.log(failures === 0 ? "\nALL CHECKS PASSED" : `\n${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
