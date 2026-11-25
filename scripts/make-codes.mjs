// Generates sponsor codes as JSON you can add to Firestore (collection sano_codes, document id = code).
// Usage: node scripts/make-codes.mjs <count> <plus|pro> <YYYY-MM-DD valid until> "<sponsor name>"
import crypto from "node:crypto";
const [count = "5", plan = "plus", until, sponsor = "Sponsor"] = process.argv.slice(2);
if (!until || !["plus", "pro"].includes(plan)) {
  console.error('Usage: node scripts/make-codes.mjs 5 plus 2027-12-31 "City Diagnostics"');
  process.exit(1);
}
const ABC = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const code = () => "SANO-" + Array.from(crypto.randomBytes(10), (b) => ABC[b % ABC.length]).join("");
const out = {};
for (let i = 0; i < Number(count); i++) out[code()] = { plan, valid_until: new Date(until + "T23:59:59+05:30").toISOString(), redeemed_by: null, sponsor };
console.log(JSON.stringify(out, null, 2));
