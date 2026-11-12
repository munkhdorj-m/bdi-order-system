import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { minutesSince } from "@/lib/dispatch";
import { formatDate } from "@/lib/datetime";

/**
 * "Can Mercury be switched off yet?" — the checklist on /admin/mercury.
 * Each item is something the website needs before it carries BDI's daily
 * work alone, read from the live data so it ticks itself off.
 *
 *   done  in place
 *   todo  something for BDI to do in the website (with a link)
 *   wait  depends on someone outside (tax office, the accountant)
 */

export type SwitchoverState = "done" | "todo" | "wait";

export type SwitchoverCheck = {
  key: string;
  title: string;
  state: SwitchoverState;
  detail: string;
  href?: string;
  linkLabel?: string;
};

/** A copy of Mercury older than this is stale while Mercury is still in daily use. */
const FRESH_DAYS = 3;
/** "Out for delivery" longer than this is probably delivered and just not ticked. */
const ON_THE_ROAD_DAYS = 2;

export async function loadSwitchoverChecks(
  supabase: SupabaseClient,
  /** When the last copy of Mercury that finished (fully or partly) ended. */
  lastCopyAt: string | null,
): Promise<SwitchoverCheck[]> {
  const count = (q: PromiseLike<{ count: number | null; error: { message: string } | null }>) =>
    Promise.resolve(q).then((r) => (r.error ? null : (r.count ?? 0)));
  const head = { count: "exact" as const, head: true };
  const roadCutoff = new Date(Date.now() - ON_THE_ROAD_DAYS * 86_400_000).toISOString();

  const [
    fix43,
    activeProducts,
    outOfStock,
    noTaxCode,
    reps,
    storesWithRep,
    distributors,
    agent,
    onTheRoad,
  ] = await Promise.all([
    supabase.from("orders").select("ordered_total").limit(1).then((r) => !r.error),
    count(supabase.from("products").select("id", head).eq("active", true)),
    count(supabase.from("products").select("id", head).eq("active", true).lte("stock", 0)),
    count(supabase.from("products").select("id", head).eq("active", true).is("ebarimt_class_code", null)),
    count(supabase.from("profiles").select("id", head).eq("role", "rep").eq("active", true)),
    count(supabase.from("supermarkets").select("id", head).not("assigned_rep_id", "is", null)),
    supabase.from("distributors").select("id, profile_id").eq("active", true),
    supabase.from("ebarimt_agent_status").select("last_seen_at, posapi_ok").eq("id", "main").maybeSingle(),
    count(supabase.from("orders").select("id", head).eq("status", "shipped").lt("shipped_at", roadCutoff)),
  ]);

  const checks: SwitchoverCheck[] = [];

  checks.push(
    fix43
      ? {
          key: "fix43",
          title: "Захиалга засах, түгээгчийн дэлгэц",
          state: "done",
          detail: "Өгөгдлийн сангийн шинэчлэл (fix 43) хийгдсэн. Захиалгын тоог хүргэлтийн дараа засах боломжтой.",
        }
      : {
          key: "fix43",
          title: "Захиалга засах, түгээгчийн дэлгэц",
          state: "todo",
          detail:
            "docs/fixes/43-mercury-replacement.sql-ийг Supabase SQL Editor дээр нэг удаа ажиллуулна. Үүнгүйгээр хүргэсэн тоог засах, түгээгчийн утасны дэлгэц ажиллахгүй.",
        },
  );

  const copyAgeDays = lastCopyAt ? minutesSince(lastCopyAt) / 1440 : null;
  checks.push(
    copyAgeDays !== null && copyAgeDays <= FRESH_DAYS
      ? {
          key: "copy",
          title: "Mercury-н хуулбар шинэ",
          state: "done",
          detail: `Сүүлд ${formatDate(lastCopyAt)}-нд хуулсан. Mercury ашиглаж байгаа үед хэд хоног тутам шинэчилнэ.`,
        }
      : {
          key: "copy",
          title: "Mercury-н хуулбар хуучирсан",
          state: "todo",
          detail:
            (lastCopyAt ? `Сүүлд ${formatDate(lastCopyAt)}-нд (${Math.floor(copyAgeDays!)} хоногийн өмнө) хуулсан. ` : "Хараахан хуулаагүй. ") +
            "Үнэ, харилцагч Mercury дээр өөрчлөгдсөн байж болно. Компьютер дээрээс web хавтсанд: npm run mercury:refresh",
        },
  );

  checks.push(
    outOfStock === 0
      ? {
          key: "stock",
          title: "Харагдаж буй бүх бараа захиалах боломжтой",
          state: "done",
          detail: `${activeProducts ?? "—"} идэвхтэй бараа бүгд үлдэгдэлтэй.`,
        }
      : {
          key: "stock",
          title: "Зарим бараа «Дууссан» гэж харагдаж байна",
          state: "todo",
          detail: `${outOfStock ?? "?"} идэвхтэй барааны үлдэгдэл 0 тул дэлгүүр захиалж чадахгүй (Mercury-гаас ирсэн бараа үлдэгдэлгүй ирдэг). Үлдэгдлийг нь оруулна.`,
          href: "/admin/products?status=visible&stock=out",
          linkLabel: "Үлдэгдэл оруулах",
        },
  );

  checks.push(
    (reps ?? 0) > 0 && (storesWithRep ?? 0) > 0
      ? {
          key: "reps",
          title: "Борлуулагч вэбээр захиалга авна",
          state: "done",
          detail: `${reps} төлөөлөгч, ${storesWithRep} дэлгүүр оноогдсон.`,
          href: "/admin/users",
          linkLabel: "Хэрэглэгч",
        }
      : {
          key: "reps",
          title: "Борлуулагчид бүртгэл хэрэгтэй",
          state: "todo",
          detail:
            (reps ?? 0) === 0
              ? "Mercury-н утасны аппаар захиалга авдаг хүнд «Төлөөлөгч» эрхтэй бүртгэл үүсгэнэ. Дараа нь бүртгэлийнх нь хуудаснаас дэлгүүрүүдийг бөөнөөр нь онооно."
              : "Төлөөлөгч бүртгэлтэй ч дэлгүүр оноогоогүй байна. Бүртгэлийнх нь хуудаснаас «Mercury дээрх менежерээр нь оноох»-ыг дарна.",
          href: (reps ?? 0) === 0 ? "/admin/users/new" : "/admin/users",
          linkLabel: (reps ?? 0) === 0 ? "Бүртгэл үүсгэх" : "Хэрэглэгч",
        },
  );

  const linked = distributors.error ? 0 : (distributors.data ?? []).filter((d) => d.profile_id).length;
  checks.push(
    linked > 0
      ? {
          key: "driver",
          title: "Түгээгч утсаараа хүргэлтээ тэмдэглэнэ",
          state: "done",
          detail: `${linked} түгээгч бүртгэлтэйгээ холбогдсон.`,
        }
      : {
          key: "driver",
          title: "Түгээгчийн утасны дэлгэц",
          state: "todo",
          detail: distributors.error
            ? "Эхлээд fix 43-ыг ажиллуулна. Дараа нь түгээгчийн бүртгэлийг «Хэрэглэгч» хуудаснаас түгээгчтэй холбоно."
            : "Түгээгчийн бүртгэлийн хуудаснаас «Хүргэлт хийдэг үү?» хэсэгт түгээгчийг нь сонгоно. Тэгвэл хүргэсэн тоогоо утсаараа засаж, «Хүргэсэн» дарна.",
          href: "/admin/users",
          linkLabel: "Хэрэглэгч",
        },
  );

  checks.push(
    (onTheRoad ?? 0) === 0
      ? {
          key: "road",
          title: "Хүргэлтийн тэмдэглэгээ цэгцтэй",
          state: "done",
          detail: "Олон хоног «Хүргэлтэнд гарсан» хэвээр үлдсэн захиалга алга.",
        }
      : {
          key: "road",
          title: "Хүргэгдсэн эсэх нь тэмдэглэгдээгүй захиалга",
          state: "todo",
          detail: `${onTheRoad} захиалга ${ON_THE_ROAD_DAYS}-оос дээш хоног «Хүргэлтэнд гарсан» хэвээр байна. Хүргэгдсэн бол ачилт дээрээс «Бүгд хүргэгдсэн» дарна.`,
          href: "/admin/orders?status=shipped",
          linkLabel: "Захиалгууд",
        },
  );

  const agentRow = agent.data as { last_seen_at: string | null; posapi_ok: boolean | null } | null;
  const agentOnline = !!agentRow?.last_seen_at && minutesSince(agentRow.last_seen_at) < 2 && agentRow.posapi_ok === true;
  checks.push(
    agentOnline
      ? {
          key: "ebarimt",
          title: "Е-баримт вэбээс илгээгдэнэ",
          state: "done",
          detail:
            (noTaxCode ?? 0) > 0
              ? `Е-баримтын компьютер онлайн. ${noTaxCode} идэвхтэй бараанд ангиллын код алга — барааны хуудаснаас нөхнө.`
              : "Е-баримтын компьютер онлайн, PosAPI холбогдсон.",
          href: "/admin/ebarimt",
          linkLabel: "Е-баримт",
        }
      : {
          key: "ebarimt",
          title: "Е-баримт: BDI-н өөрийн PosAPI хэрэгтэй",
          state: "wait",
          detail:
            "Одоо баримтыг Mercury-н (BTGT) PosAPI илгээдэг. Вэбээс илгээхийн тулд татварын албанаас BDI-н нэр дээр PosAPI 3.0 авч, нэг компьютерт суулгана (заавар: docs/ebarimt-setup.md). Тэр болтол нэг борлуулалтын баримтыг зөвхөн нэг газраас гаргана.",
          href: "/admin/ebarimt",
          linkLabel: "Е-баримт",
        },
  );

  checks.push({
    key: "erp",
    title: "Борлуулалтыг санхүүгийн программд (Dayansoft) оруулах",
    state: "wait",
    detail:
      "Dayansoft одоо борлуулалтаа Mercury-гаас өөрөө татдаг. Mercury зогсвол «Ачилтын жагсаалт» дээрх «Dayansoft» файлыг нягтлан Dayansoft-д импортолно. Эхний удаа нягтлантай хамт нэг өдрийн файлаар туршиж, код таарч байгааг шалгана.",
    href: "/admin/shipments",
    linkLabel: "Ачилтын жагсаалт",
  });

  return checks;
}
