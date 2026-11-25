import type { Specialty } from "../types";

/**
 * Cross-specialty relation catalogue. Each relation links groups of "signals" extracted from the
 * user's records. A relation is reported only when the user's records contain signals from its
 * groups, and the wording always describes ASSOCIATION, never causation or diagnosis.
 */
export interface RelationGroup {
  label: string;
  anyOf: string[];
}
export interface Relation {
  id: string;
  title: string;
  specialties: Specialty[];
  groups: RelationGroup[];
  /** Minimum number of matched groups to show as "documented"; fewer matches show as "partial". */
  documentedAt: number;
  why: string;
  caution: string;
  questions: string[];
  sourceIds: string[];
}

export const RELATIONS: Relation[] = [
  {
    id: "metformin-b12-nerves",
    title: "Metformin, vitamin B12 and nerve symptoms",
    specialties: ["Endocrinology", "Nutrition", "Neurology"],
    groups: [
      { label: "Metformin in the medication history", anyOf: ["med:metformin"] },
      { label: "Low vitamin B12 result", anyOf: ["lab:low_vitamin_b12"] },
      { label: "Tingling / numbness symptoms", anyOf: ["sx:neuropathy"] },
    ],
    documentedAt: 2,
    why: "Long-term metformin is associated with lower vitamin B12 levels, and low B12 can affect nerves, causing tingling or numbness. Diabetes itself can also affect nerves, so the symptoms could have more than one explanation.",
    caution: "These are associations. Whether B12 is contributing to any symptom can only be judged by a clinician.",
    questions: [
      "Has my vitamin B12 been checked since I started metformin, and does it need monitoring?",
      "Could my tingling or numbness relate to B12, blood sugar, or something else?",
      "Which clinician should coordinate the diabetes and nerve questions?",
    ],
    sourceIds: ["ods-b12", "medlineplus-neuropathy"],
  },
  {
    id: "anaemia-cardiac-symptoms",
    title: "Anaemia and heart-related symptoms",
    specialties: ["Haematology", "Cardiology", "General Medicine"],
    groups: [
      { label: "Low haemoglobin or low iron stores", anyOf: ["lab:low_hemoglobin", "lab:low_ferritin"] },
      { label: "Tiredness, palpitations or breathlessness", anyOf: ["sx:fatigue", "sx:palpitations", "sx:dyspnea"] },
      { label: "Heart-related assessment in the records", anyOf: ["proc:ecg", "proc:holter", "visit:cardiology", "dx:hypertension"] },
    ],
    documentedAt: 2,
    why: "Anaemia can cause tiredness, palpitations and breathlessness on exertion — symptoms that are also common reasons for a cardiology review. Clinicians may want to consider the blood count and heart assessment together.",
    caution: "This does not mean the symptoms are caused by anaemia. Heart rhythm and other causes still need clinician evaluation.",
    questions: [
      "Could my blood count be relevant to the palpitations or breathlessness I reported?",
      "Does my cardiologist have my latest blood results, including iron studies?",
    ],
    sourceIds: ["medlineplus-anemia", "medlineplus-arrhythmia"],
  },
  {
    id: "thyroid-lipids-cardiac",
    title: "Thyroid results, cholesterol and heart symptoms",
    specialties: ["Endocrinology", "Cardiology"],
    groups: [
      { label: "Raised TSH", anyOf: ["lab:high_tsh"] },
      { label: "Raised LDL / cholesterol", anyOf: ["lab:high_ldl", "lab:high_total_cholesterol", "dx:dyslipidemia"] },
      { label: "Palpitations, fatigue or cold intolerance", anyOf: ["sx:palpitations", "sx:fatigue", "sx:cold", "sx:weight"] },
    ],
    documentedAt: 2,
    why: "An underactive thyroid is associated with raised cholesterol, and thyroid conditions can be associated with tiredness and changes in heart rate. Cardiology and endocrinology teams may therefore want to see each other's results.",
    caution: "A raised TSH is not a diagnosis. It usually needs free T4 and sometimes a repeat test.",
    questions: [
      "Do my thyroid results need follow-up (free T4 or a repeat TSH) before interpreting my cholesterol?",
      "Has my cardiologist seen my thyroid results?",
    ],
    sourceIds: ["medlineplus-hypothyroid", "medlineplus-cholesterol"],
  },
  {
    id: "iron-digestive",
    title: "Low iron stores and the digestive system",
    specialties: ["Haematology", "Gastroenterology"],
    groups: [
      { label: "Low ferritin or small red cells (low MCV)", anyOf: ["lab:low_ferritin", "lab:low_mcv", "dx:iron_deficiency"] },
      { label: "Digestive symptoms or conditions", anyOf: ["sx:gi", "dx:celiac", "dx:gerd", "dx:ibs"] },
      { label: "Acid-reducing medicine", anyOf: ["med:ppi"] },
    ],
    documentedAt: 2,
    why: "When iron stores are low, clinicians often consider whether iron intake, absorption or blood loss (including from the digestive tract) needs to be explored. Acid-reducing medicines and coeliac disease are also associated with lower iron absorption.",
    caution: "This is a standard line of enquiry, not a suggestion that a digestive condition is present.",
    questions: [
      "What is the likely reason for my low iron stores, and has a digestive cause been considered?",
      "Is a gastroenterology review appropriate for me?",
    ],
    sourceIds: ["ods-iron", "medlineplus-anemia", "medlineplus-celiac"],
  },
  {
    id: "diabetes-bp-kidney",
    title: "Blood sugar, blood pressure and kidney health",
    specialties: ["Endocrinology", "Cardiology", "Nephrology"],
    groups: [
      { label: "Raised blood-sugar markers or diabetes", anyOf: ["lab:high_hba1c", "lab:high_fasting_glucose", "dx:diabetes"] },
      { label: "High blood pressure or blood-pressure medicine", anyOf: ["dx:hypertension", "med:antihypertensive", "vital:high_bp"] },
      { label: "Kidney function result", anyOf: ["lab:creatinine", "lab:egfr", "dx:ckd"] },
    ],
    documentedAt: 2,
    why: "Diabetes and high blood pressure are leading causes of chronic kidney disease, so kidney function (and a urine albumin test) is routinely checked when both are present.",
    caution: "A normal creatinine does not rule out early kidney changes, and an abnormal one needs repeat testing before conclusions.",
    questions: [
      "Have my kidney function and urine albumin been checked recently given my blood sugar and blood pressure?",
      "Who is coordinating my diabetes, blood pressure and kidney monitoring?",
    ],
    sourceIds: ["medlineplus-ckd", "who-diabetes", "who-hypertension"],
  },
  {
    id: "vitd-calcium-bone",
    title: "Vitamin D, calcium and bone health",
    specialties: ["Endocrinology", "Nutrition"],
    groups: [
      { label: "Low vitamin D", anyOf: ["lab:low_vitamin_d"] },
      { label: "Calcium result", anyOf: ["lab:calcium"] },
      { label: "Bone-health history", anyOf: ["dx:osteoporosis", "sx:bone"] },
    ],
    documentedAt: 2,
    why: "Vitamin D is needed to absorb calcium, and calcium is regulated alongside the parathyroid glands and kidneys, so these results are usually read together.",
    caution: "A normal calcium level is common even when vitamin D is low.",
    questions: [
      "Are my vitamin D and calcium results consistent, and is any bone-health assessment appropriate?",
      "Should kidney function or parathyroid hormone be reviewed?",
    ],
    sourceIds: ["ods-vitd", "ods-calcium"],
  },
  {
    id: "ppi-nutrients",
    title: "Acid-reducing medicines and nutrient levels",
    specialties: ["Gastroenterology", "Nutrition"],
    groups: [
      { label: "Acid-reducing medicine (e.g. omeprazole, pantoprazole)", anyOf: ["med:ppi"] },
      { label: "Low B12, iron or calcium", anyOf: ["lab:low_vitamin_b12", "lab:low_ferritin", "lab:low_calcium"] },
    ],
    documentedAt: 2,
    why: "Long-term acid-reducing medicines are associated with reduced absorption of vitamin B12, iron and magnesium.",
    caution: "Never stop a prescribed medicine on your own — discuss it with the prescriber.",
    questions: ["Do I still need my acid-reducing medicine, and should nutrient levels be monitored?"],
    sourceIds: ["ods-b12", "ods-iron", "medlineplus-gerd"],
  },
  {
    id: "cardiometabolic-cluster",
    title: "Cholesterol, blood sugar and blood pressure together",
    specialties: ["Cardiology", "Endocrinology"],
    groups: [
      { label: "Raised cholesterol or cholesterol medicine", anyOf: ["lab:high_ldl", "dx:dyslipidemia", "med:statin"] },
      { label: "Raised blood-sugar markers or diabetes", anyOf: ["lab:high_hba1c", "lab:high_fasting_glucose", "dx:diabetes"] },
      { label: "High blood pressure or blood-pressure medicine", anyOf: ["dx:hypertension", "med:antihypertensive", "vital:high_bp"] },
    ],
    documentedAt: 2,
    why: "Cardiovascular risk depends on several factors together — cholesterol, blood sugar and blood pressure among them — so clinicians assess them as a set rather than one at a time.",
    caution: "Combined risk can only be estimated by a clinician using validated tools and your full history.",
    questions: ["What is my overall cardiovascular picture, and which team is coordinating it?"],
    sourceIds: ["who-cvd", "medlineplus-cholesterol"],
  },
  {
    id: "fatigue-multifactor",
    title: "Tiredness with several abnormal results",
    specialties: ["General Medicine", "Haematology", "Endocrinology", "Nutrition"],
    groups: [
      { label: "Persistent tiredness recorded", anyOf: ["sx:fatigue"] },
      { label: "Low haemoglobin", anyOf: ["lab:low_hemoglobin"] },
      { label: "Abnormal thyroid result", anyOf: ["lab:high_tsh", "lab:low_tsh"] },
      { label: "Raised blood sugar marker", anyOf: ["lab:high_hba1c", "lab:high_fasting_glucose"] },
      { label: "Low vitamin or iron-store result", anyOf: ["lab:low_vitamin_b12", "lab:low_vitamin_d", "lab:low_ferritin", "lab:low_folate"] },
    ],
    documentedAt: 3,
    why: "Tiredness rarely has a single cause. Anaemia, thyroid function, blood sugar and nutrient levels can each be associated with it, so clinicians often look at them together.",
    caution: "Several abnormal results do not show that any one is responsible for the tiredness; sleep, mood and medicines also matter.",
    questions: [
      "Taken together, which of my results are most relevant to my tiredness, and in what order should they be followed up?",
      "Would one clinician reviewing all results together be appropriate?",
    ],
    sourceIds: ["medlineplus-fatigue", "medlineplus-anemia"],
  },
];
