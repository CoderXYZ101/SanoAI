/** Plain constants shared by server and client (kept free of zod so client bundles stay small). */
export const CATEGORIES = ["lab", "medication", "symptom", "diagnosis", "visit", "procedure", "imaging", "allergy", "other"] as const;
export type Category = (typeof CATEGORIES)[number];

export const SPECIALTIES = [
  "General Medicine",
  "Cardiology",
  "Endocrinology",
  "Neurology",
  "Gastroenterology",
  "Nutrition",
  "Haematology",
  "Nephrology",
  "Other",
] as const;
export type Specialty = (typeof SPECIALTIES)[number];

export const DATE_CERTAINTY = ["explicit", "document", "ambiguous", "partial", "unlabeled", "missing"] as const;
export type DateCertainty = (typeof DATE_CERTAINTY)[number];

export type DocType = "lab_report" | "prescription" | "consultation" | "discharge" | "imaging" | "other";
export const DOC_TYPES: { value: DocType; label: string }[] = [
  { value: "lab_report", label: "Blood / lab report" },
  { value: "prescription", label: "Prescription" },
  { value: "consultation", label: "Consultation summary" },
  { value: "discharge", label: "Discharge summary" },
  { value: "imaging", label: "Imaging / procedure report" },
  { value: "other", label: "Other record" },
];
