/**
 * Medicine reference used for (a) recognising medications in records and (b) the Pharmacy Connector.
 * It lists names and classes only — no dosing guidance. Authoritative information is always linked
 * to the official label (DailyMed) / MedlinePlus rather than restated here.
 */
export interface DrugDef {
  generic: string;
  brands: string[];
  drugClass: string;
  /** Typically requires a prescription (varies by country). */
  rx: boolean;
  usedFor: string;
  /** Plain-language points from general labelling, intentionally non-prescriptive. */
  generalNotes: string[];
  /** Tags used by blind-spot / cross-specialty engines. */
  tags: string[];
}

export const DRUGS: DrugDef[] = [
  {
    generic: "metformin",
    brands: ["glycomet", "gluformin", "glucophage"],
    drugClass: "biguanide (diabetes medicine)",
    rx: true,
    usedFor: "Commonly prescribed to help control blood sugar in type 2 diabetes.",
    generalNotes: ["Often taken with meals.", "Long-term use is associated with lower vitamin B12 levels — doctors sometimes monitor B12.", "Do not change or stop without advice from the prescriber."],
    tags: ["med:metformin", "med:antidiabetic"],
  },
  {
    generic: "amlodipine",
    brands: ["amlong", "amlokind", "amlogard", "norvasc"],
    drugClass: "calcium channel blocker (blood pressure medicine)",
    rx: true,
    usedFor: "Commonly prescribed for high blood pressure and some types of chest pain.",
    generalNotes: ["Ankle swelling is a recognised side effect for some people.", "Do not stop suddenly without advice from the prescriber."],
    tags: ["med:antihypertensive"],
  },
  {
    generic: "atorvastatin",
    brands: ["lipitor", "atorva", "storvas"],
    drugClass: "statin (cholesterol medicine)",
    rx: true,
    usedFor: "Commonly prescribed to lower cholesterol and reduce cardiovascular risk.",
    generalNotes: ["Report unexplained muscle pain or weakness to a doctor.", "Do not change dose without advice from the prescriber."],
    tags: ["med:statin"],
  },
  {
    generic: "rosuvastatin",
    brands: ["crestor", "rosuvas"],
    drugClass: "statin (cholesterol medicine)",
    rx: true,
    usedFor: "Commonly prescribed to lower cholesterol and reduce cardiovascular risk.",
    generalNotes: ["Report unexplained muscle pain or weakness to a doctor."],
    tags: ["med:statin"],
  },
  {
    generic: "levothyroxine",
    brands: ["synthroid", "eltroxin", "thyronorm", "euthyrox"],
    drugClass: "thyroid hormone replacement",
    rx: true,
    usedFor: "Replaces thyroid hormone when the thyroid is underactive.",
    generalNotes: ["Usually taken on an empty stomach; iron and calcium supplements can reduce absorption if taken at the same time.", "Dose changes are made by the prescriber after blood tests."],
    tags: ["med:levothyroxine"],
  },
  {
    generic: "omeprazole",
    brands: ["prilosec", "losec", "omez"],
    drugClass: "proton pump inhibitor (acid reducer)",
    rx: false,
    usedFor: "Reduces stomach acid; used for reflux and ulcers.",
    generalNotes: ["Long-term use is associated with lower absorption of B12, iron and magnesium.", "Ask a doctor or pharmacist if you need it for more than a short course."],
    tags: ["med:ppi"],
  },
  {
    generic: "pantoprazole",
    brands: ["protonix", "pantocid", "pantop"],
    drugClass: "proton pump inhibitor (acid reducer)",
    rx: true,
    usedFor: "Reduces stomach acid; used for reflux and ulcers.",
    generalNotes: ["Long-term use is associated with lower absorption of B12, iron and magnesium."],
    tags: ["med:ppi"],
  },
  {
    generic: "amoxicillin",
    brands: ["novamox", "moxikind", "augmentin", "amoxil"],
    drugClass: "penicillin-type antibiotic",
    rx: true,
    usedFor: "Antibiotic for bacterial infections.",
    generalNotes: ["Belongs to the penicillin family — tell prescribers and pharmacists about any penicillin allergy.", "Antibiotics treat bacterial, not viral, infections."],
    tags: ["med:penicillin", "med:antibiotic"],
  },
  {
    generic: "azithromycin",
    brands: ["zithromax", "azithral"],
    drugClass: "macrolide antibiotic",
    rx: true,
    usedFor: "Antibiotic for some bacterial infections.",
    generalNotes: ["Antibiotics treat bacterial, not viral, infections."],
    tags: ["med:antibiotic"],
  },
  {
    generic: "paracetamol",
    brands: ["dolo", "crocin", "calpol", "acetaminophen", "panadol"],
    drugClass: "pain and fever reliever",
    rx: false,
    usedFor: "Relieves mild to moderate pain and reduces fever.",
    generalNotes: ["Many cold and flu products also contain paracetamol — check labels to avoid taking too much.", "Follow the label or your pharmacist's advice on maximum daily amounts."],
    tags: ["med:analgesic"],
  },
  {
    generic: "ibuprofen",
    brands: ["advil", "nurofen", "brufen", "motrin"],
    drugClass: "NSAID (anti-inflammatory pain reliever)",
    rx: false,
    usedFor: "Relieves pain, fever and inflammation.",
    generalNotes: ["Can irritate the stomach and affect kidney function and blood pressure in some people.", "Check with a pharmacist if you have kidney, heart or stomach conditions or take blood-pressure medicines."],
    tags: ["med:nsaid"],
  },
  {
    generic: "aspirin",
    brands: ["ecosprin", "disprin"],
    drugClass: "antiplatelet / NSAID",
    rx: false,
    usedFor: "Pain relief; low-dose aspirin is sometimes prescribed to reduce clot risk.",
    generalNotes: ["Do not start or stop daily aspirin without medical advice.", "Can increase bleeding risk."],
    tags: ["med:nsaid", "med:antiplatelet"],
  },
  {
    generic: "ferrous sulfate",
    brands: ["feosol", "fefol", "ferrograd"],
    drugClass: "iron supplement",
    rx: false,
    usedFor: "Iron supplement used when a clinician has identified low iron.",
    generalNotes: ["Can darken stools and cause stomach upset.", "Iron overdose is dangerous for children — store safely.", "Should be used on the advice of a clinician after testing."],
    tags: ["med:iron"],
  },
  {
    generic: "cholecalciferol",
    brands: ["calcirol", "d-rise"],
    drugClass: "vitamin D supplement",
    rx: false,
    usedFor: "Vitamin D supplement.",
    generalNotes: ["The amount taken should be guided by a clinician after testing.", "Very high doses over long periods can cause harm."],
    tags: ["med:vitd"],
  },
  {
    generic: "cyanocobalamin",
    brands: ["methylcobalamin", "neurobion", "mecobalamin"],
    drugClass: "vitamin B12 supplement",
    rx: false,
    usedFor: "Vitamin B12 supplement.",
    generalNotes: ["Used when a clinician has confirmed low B12 or increased needs."],
    tags: ["med:b12"],
  },
  {
    generic: "salbutamol",
    brands: ["albuterol", "ventolin", "asthalin"],
    drugClass: "reliever inhaler (bronchodilator)",
    rx: true,
    usedFor: "Quick relief of wheeze and breathlessness in asthma.",
    generalNotes: ["Needing it more often than usual means asthma control should be reviewed urgently."],
    tags: ["med:inhaler"],
  },
  {
    generic: "cetirizine",
    brands: ["cetzine", "okacet", "alerid", "zyrtec"],
    drugClass: "antihistamine",
    rx: false,
    usedFor: "Relieves allergy symptoms such as hay fever and hives.",
    generalNotes: ["May cause drowsiness in some people."],
    tags: ["med:antihistamine"],
  },
  {
    generic: "losartan",
    brands: ["cozaar", "losar", "repace"],
    drugClass: "ARB (blood pressure medicine)",
    rx: true,
    usedFor: "Commonly prescribed for high blood pressure and some kidney conditions.",
    generalNotes: ["Kidney function and potassium are usually monitored."],
    tags: ["med:antihypertensive"],
  },
  {
    generic: "telmisartan",
    brands: ["telma", "telmikind"],
    drugClass: "ARB (blood pressure medicine)",
    rx: true,
    usedFor: "Commonly prescribed for high blood pressure.",
    generalNotes: ["Kidney function and potassium are usually monitored.", "Do not stop without advice from the prescriber."],
    tags: ["med:antihypertensive"],
  },
  {
    generic: "insulin",
    brands: ["lantus", "humulin", "novorapid", "mixtard"],
    drugClass: "insulin (diabetes medicine)",
    rx: true,
    usedFor: "Controls blood sugar in diabetes.",
    generalNotes: ["Dose is individual and must only be changed under clinical guidance."],
    tags: ["med:antidiabetic", "med:insulin"],
  },
];

export const DRUG_NAME_INDEX: { name: string; def: DrugDef }[] = DRUGS.flatMap((d) => [d.generic, ...d.brands].map((n) => ({ name: n, def: d }))).sort(
  (a, b) => b.name.length - a.name.length,
);

export function findDrug(query: string): { def: DrugDef; matched: string } | null {
  const q = query.toLowerCase();
  for (const { name, def } of DRUG_NAME_INDEX) {
    if (new RegExp(`\\b${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(q)) return { def, matched: name };
  }
  return null;
}
