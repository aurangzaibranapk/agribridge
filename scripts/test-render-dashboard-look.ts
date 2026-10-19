import assert from "node:assert";
import { resolveDashLook } from "../src/lib/render-dashboard/look";
assert.strictEqual(resolveDashLook(undefined, undefined), "old");
assert.strictEqual(resolveDashLook(undefined, "garbage"), "old");
assert.strictEqual(resolveDashLook(undefined, "new"), "new");
assert.strictEqual(resolveDashLook("old", "new"), "old");
assert.strictEqual(resolveDashLook(["new"], undefined), "new");
assert.strictEqual(resolveDashLook("x", undefined), "old");
console.log("render-dashboard-look: ok");
