/**
 * Builds two FICTIONAL medical documents (PDF) for the live-upload demonstration and checks how the app reads them.
 *   npx tsx scripts/make-sample-reports.ts
 * Output: submission/live-demo/. Nothing here describes a real person.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { pdfToText } from "../src/ai/engines/documentIntelligence";
import { extractWithRules } from "../src/ai/engines/rules";

const MARK = "FICTIONAL SAMPLE - invented for a demonstration - not a real patient or record";

const lab = [
  "SUNRISE DEMO DIAGNOSTICS",
  MARK,
  "",
  "Patient: Meera Sample    Age/Sex: 46 / F",
  "Referred by: Dr. K. Example (General Medicine)",
  "Sample collected: 18 November 2026",
  "Report date: 19 November 2026",
  "",
  "COMPLETE BLOOD COUNT",
  "Haemoglobin        10.4   g/dL    (12.0 - 15.5)   LOW",
  "MCV                74     fL      (80 - 100)      LOW",
  "",
  "IRON AND VITAMINS",
  "Ferritin           8      ng/mL   (15 - 150)      LOW",
  "Vitamin B12        240    pg/mL   (200 - 900)",
  "25-OH Vitamin D    19     ng/mL   (30 - 100)      LOW",
  "",
  "THYROID AND SUGAR",
  "TSH                6.2    mIU/L   (0.4 - 4.0)     HIGH",
  "HbA1c              6.0    %       (4.0 - 5.6)     HIGH",
  "",
  "Comments: Please correlate clinically.",
];

// Written as ordinary sentences, so that reading it needs the AI rather than the fixed table rules.
const note = [
  "SUNRISE DEMO CLINIC - FOLLOW-UP NOTE",
  MARK,
  "",
  "Meera Sample, 46, was seen on 24 November 2026.",
  "She describes feeling worn out for about two months and says her hands tingle at night.",
  "She mentions heavier periods than usual since September.",
  "She has been swallowing an over-the-counter antacid most evenings.",
  "The doctor wrote that the low iron stores will be looked at first.",
  "A free T4 blood test was suggested because the thyroid number was raised.",
  "She was asked to come back in six weeks.",
  "She reports no known drug allergies.",
];

/** A minimal one-page text PDF (Courier, so table columns line up). */
function pdf(lines: string[]): Buffer {
  const esc = (s: string) => s.replace(/[\\()]/g, "\\$&");
  const body = lines.map((l, i) => `BT /F1 9.5 Tf 40 ${800 - i * 17} Td (${esc(l)}) Tj ET`).join("\n");
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Courier >>",
    `<< /Length ${Buffer.byteLength(body, "latin1")} >>\nstream\n${body}\nendstream`,
  ];
  let out = "%PDF-1.4\n";
  const offsets = objects.map((o, i) => {
    const at = Buffer.byteLength(out, "latin1");
    out += `${i + 1} 0 obj\n${o}\nendobj\n`;
    return at;
  });
  const xref = Buffer.byteLength(out, "latin1");
  out += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.map((o) => `${String(o).padStart(10, "0")} 00000 n \n`).join("")}`;
  out += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(out, "latin1");
}

async function main() {
  mkdirSync("submission/live-demo", { recursive: true });
  for (const [file, lines, docType] of [
    ["1-fictional-blood-report.pdf", lab, "lab_report"],
    ["2-fictional-clinic-note.pdf", note, "consultation"],
  ] as const) {
    const bytes = pdf(lines);
    writeFileSync(`submission/live-demo/${file}`, bytes);
    const text = await pdfToText(new Uint8Array(bytes));
    const { events, documentDate } = extractWithRules({ id: "x", docType, title: file, text });
    console.log(`\n${file}: ${text.split("\n").length} lines read, document date ${documentDate?.iso ?? "not found"}, ${events.length} items found by the fixed rules`);
    for (const e of events) console.log(`   ${e.category.padEnd(10)} ${e.title} | ${e.values.map((v) => `${v.valueText} ${v.flag}`).join(", ")}`);
    console.log(`   => with SanoAI AI on, this file is read by ${events.length >= 3 ? "the fixed rules" : "the AI (quotes checked word for word)"}`);
  }
  process.exit(0);
}
main();
