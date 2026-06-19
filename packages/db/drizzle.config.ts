import { defineConfig } from "drizzle-kit";

// Migrations should run over a direct/session connection (Supabase port 5432),
// not the transaction pooler (6543) used by the serverless app runtime.
// Env is loaded from the repo-root .env.local via dotenv-cli in package.json.
const url = process.env.DIRECT_URL ?? process.env.DATABASE_URL;

export default defineConfig({
  schema: "./src/schema/index.ts",
  out: "./migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: url!,
  },
});
