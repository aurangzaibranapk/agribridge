import { randomBytes } from "node:crypto";

/** Login password. Math.random nahi — crypto. Har dafa naya. */
export function staffTempPassword(): string {
  return `${randomBytes(18).toString("base64url")}Aa1!`;
}
