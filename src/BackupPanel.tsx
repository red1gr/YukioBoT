// Optional "Backups" view for the Yukio dashboard (React + TS).
// Needs 5 backend routes that call the Security cog helpers (api_list / api_detail / api_create / api_restore / api_delete):
//   GET    /api/guilds/:id/backups            -> cog.api_list(g)
//   GET    /api/guilds/:id/backups/:bid       -> cog.api_detail(g, bid)
//   POST   /api/guilds/:id/backups            -> await cog.api_create(g, body.note)
//   POST   /api/guilds/:id/backups/:bid/restore -> await cog.api_restore(g, bid)   (restore settings still come from the cog toggles)
//   DELETE /api/guilds/:id/backups/:bid       -> cog.api_delete(g, bid)
import { useEffect, useState } from "react";

type Summary = { id: string; created: string; note?: string; roles: number; channels: number; categories: number; emojis: number; size: number };
type Detail = {
  id: string;
  roles: { name: string; position: number }[];
  channels: { name: string; type: string; category: string | null }[];
  emojis: { name: string }[];
};

async function call<T>(url: string, method = "GET", body?: unknown): Promise<T> {
  const r = await fetch(url, {
    method,
    credentials: "include",
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (r.status === 401) { location.href = "/login"; throw new Error("401"); }
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

export default function BackupPanel({ guildId }: { guildId: string }) {
  const base = `/api/guilds/${guildId}/backups`;
  const [list, setList] = useState<Summary[]>([]);
  const [open, setOpen] = useState<Detail | null>(null);
  const [note, setNote] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  const load = () => call<Summary[]>(base).then(setList).catch((e) => setMsg(String(e)));
  useEffect(() => { load(); }, [guildId]);

  const run = async (fn: () => Promise<unknown>, ok: string) => {
    setBusy(true); setMsg("");
    try { await fn(); setMsg(ok); await load(); } catch (e) { setMsg(String(e)); }
    setBusy(false);
  };

  return (
    <section className="card">
      <h2>Server backups</h2>
      <div className="row">
        <input placeholder="Note (optional)" value={note} onChange={(e) => setNote(e.target.value)} />
        <button disabled={busy} onClick={() => run(() => call(base, "POST", { note }), "Backup created")}>Create backup</button>
      </div>
      {msg && <p>{msg}</p>}
      {list.length === 0 && <p>No backups yet.</p>}
      <ul>
        {list.map((b) => (
          <li key={b.id}>
            <strong>{b.id}</strong> {b.note && <em>({b.note})</em>}
            <div>{b.roles} roles · {b.categories} categories · {b.channels - b.categories} channels · {b.emojis} emojis · {Math.round(b.size / 1024)} KB</div>
            <button onClick={() => call<Detail>(`${base}/${b.id}`).then(setOpen)}>View</button>{" "}
            <button disabled={busy} onClick={() => confirm(`Restore missing items from ${b.id}? Nothing existing is deleted.`) &&
              run(() => call(`${base}/${b.id}/restore`, "POST"), "Restore finished (see logs)")}>Restore</button>{" "}
            <button disabled={busy} onClick={() => confirm(`Delete ${b.id}?`) && run(() => call(`${base}/${b.id}`, "DELETE"), "Deleted")}>Delete</button>
          </li>
        ))}
      </ul>
      {open && (
        <div>
          <h3>Backup {open.id} <button onClick={() => setOpen(null)}>Close</button></h3>
          <h4>Roles</h4>
          <p>{[...open.roles].sort((a, b) => b.position - a.position).map((r) => r.name).join(", ") || "-"}</p>
          <h4>Channels</h4>
          {[null, ...open.channels.filter((c) => c.type === "category").map((c) => c.name)].map((cat) => (
            <div key={cat ?? "none"}>
              <strong>{cat ?? "No category"}</strong>
              <ul>
                {open.channels.filter((c) => c.type !== "category" && c.category === cat).map((c, i) => (
                  <li key={i}>{c.type === "voice" ? "🔊" : c.type === "forum" ? "💬" : "#"} {c.name}</li>
                ))}
              </ul>
            </div>
          ))}
          <h4>Emojis</h4>
          <p>{open.emojis.map((e) => e.name).join(", ") || "-"}</p>
        </div>
      )}
    </section>
  );
}
