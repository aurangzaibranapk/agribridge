const assert = require("assert");
const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");
const root = path.join(__dirname, "..");
const hook = fs.readFileSync(path.join(root, "src/lib/hooks/use-safe-form-state.ts"), "utf8");
assert.match(hook, /state \?\? initialState/, "undefined state initial par wapas");
const raw = execSync(`grep -rlE 'import \\{[^}]*useFormState[^}]*\\} from "react-dom"' src || true`, { cwd: root }).toString().trim().split("\n").filter(Boolean)
  .filter((f) => !f.endsWith("use-safe-form-state.ts"));
assert.deepEqual(raw, [], "useFormState sirf safe hook se aaye: " + raw.join(", "));
console.log("safe form state: theek");
