import crypto from "crypto";
import fs from "fs";
import path from "path";
import { loadEnvFile } from "../src/lib/env";

loadEnvFile();

const envPath = path.join(process.cwd(), ".env");
const examplePath = path.join(process.cwd(), ".env.example");

if (!fs.existsSync(envPath) && fs.existsSync(examplePath)) {
  const secret = crypto.randomBytes(32).toString("hex");
  const text = fs.readFileSync(examplePath, "utf8").replace(/^AUTH_SECRET=$/m, `AUTH_SECRET=${secret}`);
  fs.writeFileSync(envPath, text);
  process.env.AUTH_SECRET ||= secret;
  loadEnvFile();
}

if (!process.env.AUTH_SECRET) {
  const secret = crypto.randomBytes(32).toString("hex");
  process.env.AUTH_SECRET = secret;
  fs.appendFileSync(envPath, `\nAUTH_SECRET=${secret}\n`);
}

if (!process.env.ADMIN_EMAIL) process.env.ADMIN_EMAIL = "harry@localhost";
if (!process.env.ADMIN_PASSWORD) process.env.ADMIN_PASSWORD = "growth-engine-local";

async function main() {
  const { ensureReady } = await import("../src/lib/ready");
  await ensureReady();
  console.log("Growth Engine database is ready.");
  console.log(`Sign in as ${process.env.ADMIN_EMAIL}`);
  if (process.env.ADMIN_PASSWORD === "growth-engine-local") {
    console.log("Local default password is growth-engine-local. Change it before a public deploy.");
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
