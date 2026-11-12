// Tests the sales file for the accounting system
// (web/src/lib/dayansoft.ts + the date cells in web/src/lib/xlsx.ts):
// Dayansoft's own batch-import layout, and the arithmetic on each line.
import { loadTs } from "./load-ts.mjs";

let failures = 0;
function check(name, cond, detail = "") {
  if (cond) console.log("  ok   " + name);
  else {
    failures++;
    console.log("  FAIL " + name + (detail ? "  -> " + detail : ""));
  }
}

const { buildDayansoftBatch, DAYANSOFT_HEADERS } = loadTs("lib/dayansoft.ts");
const { buildXlsx, excelDay } = loadTs("lib/xlsx.ts");

// The template's header row, as read from Dayansoft's own file (2026-11-12).
const TEMPLATE = ["Дугаар", "Огноо", "Харилцагч код", "Харилцагч нэр", "Утга", "Борлуулагч", "Пос код", "Багц №", "Бараа данс", "Данс нэр", "Бараа код", "Бараа нэр", "Бараа тайлбар", "Comment", "Тоо хэмжээ", "Нэгж үнэ", "Нийт үнэ", "Хөнгөлөлт", "Нэгж дүн", "Нийт дүн", "НӨАТ", "НХАТ", "Cериал дугаар", "Дуусах огноо"];

const order = (over = {}) => ({
  id: "o1",
  order_number: "ORD-2026-00123",
  status: "delivered",
  subtotal: 30000,
  discount_total: 600, // the 2% cash discount
  payment_method: "cash",
  notes: "хаалганы дэргэд",
  created_at: "2026-11-10T02:00:00+00:00",
  shipped_at: "2026-11-11T01:00:00+00:00",
  delivery_date: "2026-11-11",
  shipment_id: "s1",
  store: { id: "st", name: "Дэлгүүр А", address: null, contact_phone: null, registry_number: "1234567", external_id: "2196700", type: null, district: null, ebarimt_tin: null },
  placedBy: { full_name: "Туяа", phone: null, role: "admin" },
  shipment: { shipment_no: 7, delivery_date: "2026-11-12", status: "closed", distributor: { name: "Мөнхөө", phone: null, vehicle: null } },
  items: [
    { product_id: "p1", name: "Салфетка", qty: 10, unit_price: 2200, line_total: 22000, product: { sku: "8690000000017", internal_code: "SLF1", unit: "ш", box_count: 24, vat_payable: true, city_tax: false, ebarimt_class_code: null, ebarimt_tax_code: null } },
    { product_id: "p2", name: "Номын хавчуурга", qty: 4, unit_price: 2000, line_total: 8000, product: { sku: null, internal_code: "BK2", unit: "ш", box_count: null, vat_payable: false, city_tax: false, ebarimt_class_code: null, ebarimt_tax_code: null } },
    { product_id: "p1", name: "🎁 Салфетка", qty: 1, unit_price: 0, line_total: 0, product: { sku: "8690000000017", internal_code: "SLF1", unit: "ш", box_count: 24, vat_payable: true, city_tax: false, ebarimt_class_code: null, ebarimt_tax_code: null } },
  ],
  ...over,
});
const OPTS = { account: "150101", partnerCode: "registry", itemCode: "internal" };
const col = (name) => DAYANSOFT_HEADERS.indexOf(name);

console.log("\n== The layout Dayansoft imports ==");
{
  check("the 24 column headers are exactly the template's", JSON.stringify([...DAYANSOFT_HEADERS]) === JSON.stringify(TEMPLATE), JSON.stringify([...DAYANSOFT_HEADERS]));
  check("...including the Latin 'C' the template has in 'Cериал'", DAYANSOFT_HEADERS[22].codePointAt(0) === 0x43);
  const b = buildDayansoftBatch([order()], OPTS);
  check("one sheet named 'Sheet', a plain header row", b.sheet.name === "Sheet" && b.sheet.plainHeader === true && b.sheet.columns.length === 24, JSON.stringify({ name: b.sheet.name, cols: b.sheet.columns.length }));
  check("one row per order line, gift lines too", b.lines === 3 && b.documents === 1, JSON.stringify({ lines: b.lines, documents: b.documents }));
}

console.log("\n== What each line says ==");
{
  const b = buildDayansoftBatch([order()], OPTS);
  const [l1, l2, gift] = b.sheet.rows;
  check("document number, the run's day, the store's code and name", l1[col("Дугаар")] === "ORD-2026-00123" && l1[col("Огноо")] === "2026-11-12" && l1[col("Харилцагч код")] === "1234567" && l1[col("Харилцагч нэр")] === "Дэлгүүр А", JSON.stringify(l1.slice(0, 4)));
  check("who delivered, the run number, the account and the item code", l1[col("Борлуулагч")] === "Мөнхөө" && l1[col("Багц №")] === "7" && l1[col("Бараа данс")] === "150101" && l1[col("Бараа код")] === "SLF1", JSON.stringify([l1[5], l1[7], l1[8], l1[10]]));
  // 22,000 of 30,000 → 440 of the 600 discount; net 21,560; VAT inside = 21,560 × 10/110 = 1,960.
  check("quantity, price and gross", l1[col("Тоо хэмжээ")] === 10 && l1[col("Нэгж үнэ")] === 2200 && l1[col("Нийт үнэ")] === 22000, JSON.stringify(l1.slice(14, 17)));
  check("the order's discount is shared out by value", l1[col("Хөнгөлөлт")] === 440 && l2[col("Хөнгөлөлт")] === 160, `${l1[col("Хөнгөлөлт")]} + ${l2[col("Хөнгөлөлт")]}`);
  check("net per piece and net total", l1[col("Нэгж дүн")] === 2156 && l1[col("Нийт дүн")] === 21560, `${l1[col("Нэгж дүн")]}, ${l1[col("Нийт дүн")]}`);
  check("VAT is the tax inside the net amount", l1[col("НӨАТ")] === 1960 && l1[col("НХАТ")] === 0, `${l1[col("НӨАТ")]}`);
  check("a VAT-free product carries no VAT", l2[col("НӨАТ")] === 0 && l2[col("Нийт дүн")] === 7840, JSON.stringify(l2.slice(16, 22)));
  check("a gift line: quantity, zero money, marked as a gift, no 🎁 in the name", gift[col("Тоо хэмжээ")] === 1 && gift[col("Нийт дүн")] === 0 && gift[col("Бараа тайлбар")] === "Бэлэг" && gift[col("Бараа нэр")] === "Салфетка", JSON.stringify(gift));
  check("the lines add up to what the store pays", b.total === 29400, String(b.total));

  const city = buildDayansoftBatch(
    [order({ discount_total: 0, items: [{ ...order().items[0], qty: 1, unit_price: 1120, line_total: 1120, product: { ...order().items[0].product, city_tax: true } }] })],
    OPTS,
  ).sheet.rows[0];
  check("with city tax: 1,120 = 1,000 + 100 VAT + 20 city tax", city[col("НӨАТ")] === 100 && city[col("НХАТ")] === 20, `${city[col("НӨАТ")]}, ${city[col("НХАТ")]}`);
}

console.log("\n== Which codes, and what is missing ==");
{
  let b = buildDayansoftBatch([order()], { ...OPTS, partnerCode: "mercury", itemCode: "barcode" });
  check("Mercury's customer number and the barcode can be used instead", b.sheet.rows[0][col("Харилцагч код")] === "2196700" && b.sheet.rows[0][col("Бараа код")] === "8690000000017", JSON.stringify([b.sheet.rows[0][2], b.sheet.rows[0][10]]));
  check("...falling back to the other code where one is missing", b.sheet.rows[1][col("Бараа код")] === "BK2", String(b.sheet.rows[1][col("Бараа код")]));
  check("a complete file has no warnings", buildDayansoftBatch([order()], OPTS).warnings.length === 0);

  b = buildDayansoftBatch([order({ store: { ...order().store, registry_number: null, external_id: null } })], { ...OPTS, account: " " });
  check("no account code, or a customer without any code: said up front", b.warnings.length === 2 && b.warnings.some((w) => w.includes("Бараа данс")) && b.warnings.some((w) => w.includes("Дэлгүүр А")), JSON.stringify(b.warnings));
  b = buildDayansoftBatch([order({ items: [{ ...order().items[0], product: null }] })], OPTS);
  check("a product without any code: said up front", b.warnings.some((w) => w.includes("Салфетка")), JSON.stringify(b.warnings));

  b = buildDayansoftBatch([order({ shipment: null })], OPTS);
  check("without a run the planned delivery day is the document's day", b.sheet.rows[0][col("Огноо")] === "2026-11-11" && b.sheet.rows[0][col("Борлуулагч")] === "Туяа", JSON.stringify(b.sheet.rows[0].slice(0, 6)));
  b = buildDayansoftBatch([order({ shipment: null, delivery_date: null, shipped_at: "2026-11-11T17:30:00+00:00" })], OPTS);
  check("...and without that, the Ulaanbaatar day it went out (01:30 on the 12th)", b.sheet.rows[0][col("Огноо")] === "2026-11-12", String(b.sheet.rows[0][col("Огноо")]));
  check("no orders → an empty file with just the header", buildDayansoftBatch([], OPTS).lines === 0);
}

console.log("\n== The file itself ==");
{
  check("a day becomes Excel's day number (2024-01-01 = 45292)", excelDay("2024-01-01") === 45292 && excelDay("2026-11-12") === 46338 && excelDay("nope") === null, `${excelDay("2024-01-01")}, ${excelDay("2026-11-12")}`);
  const bytes = buildXlsx([buildDayansoftBatch([order()], OPTS).sheet]);
  const text = new TextDecoder().decode(bytes); // stored uncompressed, so the XML is readable as is
  check("the sheet is called 'Sheet'", text.includes('<sheet name="Sheet" sheetId="1"'));
  check("the header row is plain text, first cell 'Дугаар', no frozen pane", text.includes('<c r="A1" t="inlineStr"><is><t xml:space="preserve">Дугаар</t>') && !text.includes("<pane "));
  check("the date is a real date cell (46338, date style)", text.includes('<c r="B2" s="4"><v>46338</v></c>'), text.match(/<c r="B2"[^>]*>.*?<\/c>/)?.[0] ?? "(no B2)");
  check("codes stay text (a registry number must not turn into a number)", text.includes('<c r="C2" t="inlineStr"><is><t xml:space="preserve">1234567</t>'));
  check("money is a number", text.includes('<c r="Q2" s="3"><v>22000</v></c>'));
}

console.log(failures === 0 ? "\nALL CHECKS PASSED" : `\n${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
