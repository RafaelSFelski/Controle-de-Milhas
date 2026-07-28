<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Cursor Cloud specific instructions

The app lives at the repository root (pnpm). It is a client-side Next.js app that talks
directly to Supabase (PostgreSQL + PostgREST + RPCs); there are no custom API routes.
Standard commands: `pnpm dev`, `pnpm lint`, `pnpm build` (see `package.json` / `README.md`).

**Cursor Cloud Agent — update/install script:** the app is at the **repository root**, not in
a `miles-dashboard/` subdirectory (removed in commit `4ddb8a9`). In
[Cloud Agents → Environments](https://cursor.com/dashboard/cloud-agents), set the install
script to:

```bash
pnpm install --frozen-lockfile
```

Do **not** use `cd miles-dashboard` — that path no longer exists and causes
`INSTALL_FAILED` at VM startup (`cd: miles-dashboard: No such file or directory`).

To run/test anything data-related you need a running Supabase instance. Docker and the
Supabase CLI are already installed in the VM snapshot; the update script only refreshes
JS deps. Start the backing services manually at the start of a session:

1. Start the Docker daemon (it does not auto-start here): `sudo dockerd &` then make the
   socket usable without sudo: `sudo chmod 666 /var/run/docker.sock`.
2. Start local Supabase from the repo root: `supabase start` (first run pulls images;
   applies the SQL migrations in `supabase/migrations/`). Use `supabase status` to check,
   `supabase db reset` to reapply migrations from scratch.
3. Start the app: `pnpm dev` (→ http://localhost:3000).

Non-obvious gotchas:
- `supabase/config.toml` sets `auto_expose_new_tables = true`. This is REQUIRED: current
  Supabase defaults do NOT grant the `anon` role access to public tables, so without it every
  PostgREST query returns `permission denied` and the whole UI shows empty/errors. Do not
  remove it (RLS is intentionally off for this personal-use app).
- `.env.local` (gitignored) points the app at local Supabase. The local anon key is the fixed
  Supabase demo key, so it is deterministic. If missing, recreate it with:
  `NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321` and
  `NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key from \`supabase status\`>`.
- Docker here runs with the `fuse-overlayfs` storage driver and the containerd-snapshotter
  feature disabled (`/etc/docker/daemon.json`); iptables is set to legacy. This is needed for
  docker-in-docker in this VM — leave it as is.
