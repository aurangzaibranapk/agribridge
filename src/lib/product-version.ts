import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Portal aur mobile app ka EK version. Source sirf repo ki VERSION file
 * hai. Dono release saath jaate hain — alag version nahi.
 */
export const PRODUCT_VERSION = readFileSync(join(process.cwd(), "VERSION"), "utf8").trim();
