// A Supabase-shaped client for tests: answers the query-builder calls the
// website's server code makes with real SQL on the local test database, so
// defaults, triggers, constraints and database functions are the real ones.
//
// It covers what the tested code uses — select (with the few embedded
// relations listed in RELATIONS), insert, update, delete, eq / lt / gt /
// in, limit, single / maybeSingle and rpc — not the whole Supabase API.
//
// `hooks.before(op, table)` / `hooks.after(op, table)` let a test fail a
// request before it runs ("never arrived"), after it ran ("answer lost"),
// hold it, or throw KILLED to play "the server died right here".

/** Thrown by a hook to play "the server was killed right here". */
export const KILLED = { killed: true };

/** table → embedded name → [other table, this table's column, other table's column] */
const RELATIONS = {
  orders: {
    placed_by: ["profiles", "placed_by", "id"],
    supermarket_id: ["supermarkets", "supermarket_id", "id"],
    order_items: null, // only as order_items(count), handled below
  },
  order_items: {
    products: ["products", "product_id", "id"],
    product_id: ["products", "product_id", "id"],
  },
};

/** "a, b, alias:fk(c, d), table(count)" → top-level pieces. */
function splitColumns(cols) {
  const out = [];
  let depth = 0;
  let cur = "";
  for (const ch of cols) {
    if (ch === "(") depth++;
    if (ch === ")") depth--;
    if (ch === "," && depth === 0) {
      out.push(cur.trim());
      cur = "";
    } else cur += ch;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}

function selectList(table, cols) {
  return splitColumns(cols)
    .map((c) => {
      if (c === "*") return "t.*";
      if (c === "order_items(count)") {
        return `(select json_build_array(json_build_object('count', count(*)::int)) from public.order_items i where i.order_id = t.id) as order_items`;
      }
      const embed = /^(?:(\w+):)?(\w+)\(([^)]*)\)$/.exec(c);
      if (embed) {
        const [, alias, name, inner] = embed;
        const rel = RELATIONS[table]?.[name];
        if (!rel) throw new Error(`fake-supabase: unknown relation ${table}.${name}`);
        const [other, mine, theirs] = rel;
        const innerCols = inner.split(",").map((x) => `e."${x.trim()}"`).join(", ");
        return `(select row_to_json(x) from (select ${innerCols} from public."${other}" e where e."${theirs}" = t."${mine}") x) as "${alias ?? name}"`;
      }
      const renamed = /^(\w+):(\w+)$/.exec(c);
      if (renamed) return `t."${renamed[2]}" as "${renamed[1]}"`;
      return `t."${c}"`;
    })
    .join(", ");
}

export function fakeAdmin(db, hooks = {}) {
  const run = async (op, table, exec) => {
    try {
      await hooks.before?.(op, table);
      const data = await exec();
      await hooks.after?.(op, table);
      return { data, error: null };
    } catch (e) {
      if (e === KILLED) throw e;
      return { data: null, error: { message: String(e?.message ?? e), code: e?.code ?? "XX000" } };
    }
  };

  class Query {
    constructor(table) {
      this.table = table;
      this.op = "select";
      this.cols = "*";
      this.returning = null;
      this.filters = [];
      this.mode = "many";
      this.max = null;
    }
    select(cols = "*") {
      if (this.op === "select") this.cols = cols;
      else this.returning = cols;
      return this;
    }
    insert(values) {
      this.op = "insert";
      this.values = values;
      return this;
    }
    update(values) {
      this.op = "update";
      this.values = values;
      return this;
    }
    delete() {
      this.op = "delete";
      return this;
    }
    eq(col, value) {
      this.filters.push([col, "=", value]);
      return this;
    }
    lt(col, value) {
      this.filters.push([col, "<", value]);
      return this;
    }
    gt(col, value) {
      this.filters.push([col, ">", value]);
      return this;
    }
    in(col, values) {
      this.filters.push([col, "in", values]);
      return this;
    }
    limit(n) {
      this.max = n;
      return this;
    }
    single() {
      this.mode = "single";
      return this;
    }
    maybeSingle() {
      this.mode = "maybe";
      return this;
    }
    then(resolve, reject) {
      return this.exec().then(resolve, reject);
    }

    where(params) {
      if (this.filters.length === 0) return "";
      return (
        " where " +
        this.filters
          .map(([col, op, value]) => {
            if (op === "in") {
              if (value.length === 0) return "false";
              // Compared as text so one list works for uuid, text and enum columns.
              params.push(value.map(String));
              return `t."${col}"::text = any($${params.length}::text[])`;
            }
            params.push(value);
            return `t."${col}" ${op} $${params.length}`;
          })
          .join(" and ")
      );
    }

    async exec() {
      const t = `public."${this.table}"`;
      return run(this.op, this.table, async () => {
        const params = [];
        let sql;
        if (this.op === "select") {
          sql = `select row_to_json(x) as j from (select ${selectList(this.table, this.cols)} from ${t} t${this.where(params)}${this.max ? ` limit ${this.max}` : ""}) x`;
        } else if (this.op === "insert") {
          // Like the API: only the keys that were sent are written, the rest keep their defaults.
          const rows = JSON.parse(JSON.stringify(Array.isArray(this.values) ? this.values : [this.values]));
          const keys = Object.keys(rows[0]).map((k) => `"${k}"`).join(", ");
          params.push(JSON.stringify(rows));
          const ins = `insert into ${t} (${keys}) select ${keys} from json_populate_recordset(null::${t}, $1::json) returning *`;
          sql = this.returning
            ? `with w as (${ins}) select row_to_json(x) as j from (select ${selectList(this.table, this.returning)} from w t) x`
            : `with w as (${ins}) select count(*) from w`;
        } else if (this.op === "update") {
          const row = JSON.parse(JSON.stringify(this.values));
          const keys = Object.keys(row).map((k) => `"${k}"`).join(", ");
          params.push(JSON.stringify(row));
          const upd = `update ${t} t set (${keys}) = (select ${keys} from json_populate_record(null::${t}, $1::json))${this.where(params)} returning *`;
          sql = this.returning
            ? `with w as (${upd}) select row_to_json(x) as j from (select ${selectList(this.table, this.returning)} from w t) x`
            : `with w as (${upd}) select count(*) from w`;
        } else {
          sql = `delete from ${t} t${this.where(params)}`;
        }
        const r = await db.query(sql, params);
        if (this.op !== "select" && !this.returning) return null;
        const rows = r.rows.map((x) => x.j);
        if (this.mode === "many") return rows;
        if (rows.length > 1 || (rows.length === 0 && this.mode === "single")) {
          const e = new Error("JSON object requested, multiple (or no) rows returned");
          e.code = "PGRST116";
          throw e;
        }
        return rows[0] ?? null;
      });
    }
  }

  return {
    from: (table) => new Query(table),
    /** rpc("fn") or rpc("fn", { p_a: 1, p_b: [..] }) — named arguments, like the API. */
    rpc: (fn, args) =>
      run("rpc", fn, async () => {
        const names = Object.keys(args ?? {});
        // Every argument travels as JSON text and is cast by the function's own types.
        const exists = await db.query(
          `select p.oid::regprocedure::text as sig,
                  (select json_agg(json_build_object('name', a.name, 'type', format_type(a.type, null)) order by a.ord)
                     from unnest(p.proargnames, p.proargtypes::oid[]) with ordinality as a(name, type, ord)) as args
             from pg_proc p join pg_namespace n on n.oid = p.pronamespace
            where n.nspname = 'public' and p.proname = $1`,
          [fn],
        );
        if (exists.rows.length === 0) {
          const e = new Error(`Could not find the function public.${fn} in the schema cache`);
          e.code = "PGRST202";
          throw e;
        }
        const types = new Map((exists.rows[0].args ?? []).map((a) => [a.name, a.type]));
        const params = [];
        const list = names.map((name) => {
          const type = types.get(name);
          if (!type) throw new Error(`fake-supabase: ${fn} has no argument ${name}`);
          const v = args[name];
          if (v === null || v === undefined) return `"${name}" => null::${type}`;
          if (type === "jsonb" || type === "json") {
            params.push(JSON.stringify(v));
            return `"${name}" => $${params.length}::${type}`;
          }
          params.push(String(v));
          return `"${name}" => $${params.length}::${type}`;
        });
        const r = await db.query(`select public."${fn}"(${list.join(", ")}) as v`, params);
        return r.rows[0].v;
      }),
  };
}
