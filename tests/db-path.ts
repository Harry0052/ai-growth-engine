import os from "os";
import path from "path";

export const TEST_DB = path.join(os.tmpdir(), "growth-engine-vitest.sqlite");
