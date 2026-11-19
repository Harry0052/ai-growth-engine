import fs from "fs";
import { TEST_DB } from "./db-path";

export default function setup() {
  fs.rmSync(TEST_DB, { force: true });
}
