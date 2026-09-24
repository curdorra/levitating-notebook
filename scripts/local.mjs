// `npm run dev` (live-reloading) or `npm run preview` (production build, fast).
// If you've set DATABASE_URL (e.g. your Neon dev branch in .env.local) this
// just runs Next. Otherwise it starts one embedded PGlite database in
// ./.pglite, serves it as Postgres on a local port, applies migrations, and
// runs Next against it. One server process matters: Next runs code in several
// processes, and PGlite must have a single owner.
import { spawn } from "node:child_process";
import { config } from "dotenv";

config({ path: [".env.local", ".env"], quiet: true });

const env = { ...process.env };
let shutdown = async () => {};

if (!env.DATABASE_URL) {
  const { PGlite } = await import("@electric-sql/pglite");
  const { PGLiteSocketServer } = await import("@electric-sql/pglite-socket");
  const { drizzle } = await import("drizzle-orm/pglite");
  const { migrate } = await import("drizzle-orm/pglite/migrator");

  const pg = await PGlite.create("./.pglite");
  await migrate(drizzle(pg), { migrationsFolder: "./drizzle" });

  const port = Number(env.PGLITE_PORT ?? 54329);
  const server = new PGLiteSocketServer({ db: pg, host: "127.0.0.1", port, maxConnections: 10 });
  await server.start();

  env.DATABASE_URL = `postgres://postgres:postgres@127.0.0.1:${port}/postgres?sslmode=disable`;
  console.log(`[db] Local PGlite database (./.pglite) on 127.0.0.1:${port}`);

  shutdown = async () => {
    await server.stop();
    await pg.close();
  };
}

const mode = process.argv[2] === "preview" ? "preview" : "dev";
const command =
  mode === "preview" ? "npx next build && npx next start" : `npx next dev ${process.argv.slice(3).join(" ")}`;
const next = spawn(command, { stdio: "inherit", env, shell: true });

let stopping = false;
async function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  next.kill("SIGINT");
  await shutdown();
  process.exit(code);
}
process.on("SIGINT", () => stop());
process.on("SIGTERM", () => stop());
next.on("exit", (code) => stop(code ?? 0));
