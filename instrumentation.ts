/**
 * Server shuru hote hi ek dafa chalta hai.
 *
 * "fetch failed" (15/16 September) -- server Supabase tak pahunch nahi
 * pa raha tha, password ya code se koi wasta nahi tha. Aam wajah: kai
 * shared/VPS hosts ka IPv6 raasta kharab hota hai, aur agar DNS pehle
 * IPv6 address de de (jo aam hai), connection wahin atak jata hai --
 * chahe IPv4 se seedha kaam ho sakta ho. Node ko IPv4 pehle try karne
 * ko kehna is poori class ke masle ko hal kar deta hai.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const dns = await import("dns");
    dns.setDefaultResultOrder("ipv4first");
  }
}
