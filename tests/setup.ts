import { TEST_DB } from "./db-path";

process.env.DATABASE_URL = "";
delete process.env.DATABASE_URL;
process.env.SQLITE_PATH = TEST_DB;
process.env.AUTH_SECRET = "test-secret";
process.env.ADMIN_EMAIL = "harry@localhost";
process.env.ADMIN_PASSWORD = "growth-engine-local";
process.env.NODE_ENV = "test";
