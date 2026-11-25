import type { KbFact } from "./kb";

/**
 * Counterfactual Health Simulator — evidence model.
 *
 * This is an EDUCATIONAL model of how lifestyle factors line up with public-health guidance and
 * which health domains they are associated with in population evidence. It does NOT estimate
 * probabilities, risks or an individual's future condition. "Alignment" (0–1) is only the
 * distance of a habit from the cited guidance range and is shown to users as a band
 * (within / approaching / outside guidance), never as a percentage or risk.
 */

export interface SimInputs {
  sleepHours: number;
  activityMin: number; // moderate-intensity minutes per week
  fruitVeg: number; // portions per day
  sweetDrinks: number; // sugar-sweetened drinks per week
  alcoholUnits: number; // units per week
  smoking: "never" | "former" | "current";
  stress: number; // 1 (low) – 5 (high)
  sittingHours: number; // hours per day
}

export const DEFAULT_INPUTS: SimInputs = {
  sleepHours: 6,
  activityMin: 60,
  fruitVeg: 2,
  sweetDrinks: 5,
  alcoholUnits: 8,
  smoking: "never",
  stress: 3,
  sittingHours: 9,
};

export type DomainId = "cardiometabolic" | "bloodPressure" | "energySleep" | "moodStress" | "weight";

export const DOMAINS: { id: DomainId; label: string; blurb: string }[] = [
  { id: "cardiometabolic", label: "Heart & metabolic health", blurb: "Heart disease and type 2 diabetes risk factors" },
  { id: "bloodPressure", label: "Blood pressure", blurb: "Factors associated with blood pressure" },
  { id: "energySleep", label: "Energy & sleep quality", blurb: "Daytime energy and restorative sleep" },
  { id: "moodStress", label: "Mood & stress", blurb: "Mood, stress and resilience" },
  { id: "weight", label: "Weight management", blurb: "Energy balance and body weight" },
];

export interface FactorDef {
  id: keyof SimInputs;
  label: string;
  unit: string;
  guidance: string;
  weights: Partial<Record<DomainId, number>>;
  /** 0..1 — closeness to the guidance range. */
  align(value: number | string): number;
  evidence: KbFact[];
  sourceIds: string[];
  doctorQuestion: string;
}

const clamp = (n: number, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, n));

export const FACTORS: FactorDef[] = [
  {
    id: "sleepHours",
    label: "Sleep",
    unit: "hours/night",
    guidance: "Public-health guidance: 7 or more hours per night for adults.",
    weights: { energySleep: 1, moodStress: 0.6, cardiometabolic: 0.4, weight: 0.3, bloodPressure: 0.3 },
    align: (v) => {
      const h = Number(v);
      if (h >= 7 && h <= 9) return 1;
      if (h > 9) return clamp(0.8 - (h - 9) * 0.15, 0.4, 0.8);
      return clamp(0.15 + ((h - 4) / 3) * 0.85, 0.1, 0.99);
    },
    evidence: [
      { text: "Population studies associate regularly sleeping fewer than about 7 hours with higher blood pressure, weight gain, type 2 diabetes and low mood.", status: "established" },
      { text: "How much any one person's outcomes would change by sleeping longer is uncertain and varies between individuals.", status: "emerging" },
    ],
    sourceIds: ["cdc-sleep", "medlineplus-sleep"],
    doctorQuestion: "Is my sleep pattern something to look into further (for example snoring or daytime sleepiness)?",
  },
  {
    id: "activityMin",
    label: "Physical activity",
    unit: "min/week (moderate)",
    guidance: "WHO: 150–300 minutes of moderate-intensity activity per week for adults.",
    weights: { cardiometabolic: 1, weight: 0.8, bloodPressure: 0.6, moodStress: 0.5, energySleep: 0.4 },
    align: (v) => clamp(0.1 + (0.9 * Number(v)) / 150),
    evidence: [
      { text: "Regular physical activity is associated with lower rates of heart disease, type 2 diabetes and depression, and with better sleep.", status: "established" },
      { text: "Benefits begin at levels below the target; any increase is generally better than none.", status: "established" },
    ],
    sourceIds: ["who-activity"],
    doctorQuestion: "Is it safe for me to increase my activity, and how should I build up given my medical history?",
  },
  {
    id: "fruitVeg",
    label: "Fruit & vegetables",
    unit: "portions/day",
    guidance: "WHO: at least 400 g a day (about five portions).",
    weights: { cardiometabolic: 0.7, bloodPressure: 0.5, weight: 0.4 },
    align: (v) => clamp(0.2 + (0.8 * Number(v)) / 5),
    evidence: [
      { text: "Diets rich in fruit and vegetables are associated with lower blood pressure and lower cardiovascular disease risk.", status: "established" },
      { text: "Which specific foods drive the benefit is still being studied.", status: "emerging" },
    ],
    sourceIds: ["who-diet"],
    doctorQuestion: "Are there dietary changes I should avoid or prioritise given my results and medicines?",
  },
  {
    id: "sweetDrinks",
    label: "Sugar-sweetened drinks",
    unit: "drinks/week",
    guidance: "WHO: keep free sugars below 10% of energy intake; sugary drinks are a major source.",
    weights: { weight: 0.8, cardiometabolic: 0.7 },
    align: (v) => clamp(1 - Number(v) * 0.09, 0.15, 1),
    evidence: [
      { text: "Higher intake of sugar-sweetened drinks is associated with weight gain and a higher risk of type 2 diabetes.", status: "established" },
    ],
    sourceIds: ["who-diet"],
    doctorQuestion: "How should I think about sugar intake given my blood sugar results?",
  },
  {
    id: "alcoholUnits",
    label: "Alcohol",
    unit: "standard drinks/week",
    guidance: "WHO: no level of alcohol is without risk — less is better.",
    weights: { bloodPressure: 0.6, cardiometabolic: 0.5, energySleep: 0.4, moodStress: 0.3 },
    align: (v) => {
      const u = Number(v);
      if (u <= 0) return 1;
      if (u <= 14) return 1 - 0.25 * (u / 14);
      return clamp(0.75 - (u - 14) * 0.03, 0.1, 0.75);
    },
    evidence: [
      { text: "Regular heavy drinking is associated with higher blood pressure, liver disease, poorer sleep quality and some cancers.", status: "established" },
      { text: "Whether very low intake carries any benefit is contested; current guidance emphasises that no level is risk-free.", status: "emerging" },
    ],
    sourceIds: ["who-alcohol"],
    doctorQuestion: "Does my alcohol intake interact with any of my medicines or results?",
  },
  {
    id: "smoking",
    label: "Tobacco use",
    unit: "status",
    guidance: "Avoid all tobacco (smoked or chewed, including gutka); stopping at any age brings benefits.",
    weights: { cardiometabolic: 1, bloodPressure: 0.5 },
    align: (v) => (v === "never" ? 1 : v === "former" ? 0.8 : 0.1),
    evidence: [{ text: "Smoking is a leading preventable cause of heart attack, stroke, lung disease and cancer; risk falls after stopping.", status: "established" }],
    sourceIds: ["who-tobacco"],
    doctorQuestion: "What support is available to help me stop smoking?",
  },
  {
    id: "stress",
    label: "Perceived stress",
    unit: "1 (low) – 5 (high)",
    guidance: "No numeric guideline; persistent high stress is worth discussing with a clinician.",
    weights: { moodStress: 1, energySleep: 0.6, bloodPressure: 0.4 },
    align: (v) => clamp(1.2 - Number(v) * 0.2, 0.2, 1),
    evidence: [
      { text: "Ongoing stress is associated with poorer sleep, higher blood pressure and unhealthy coping behaviours.", status: "established" },
      { text: "The effect of specific stress-reduction techniques differs widely between people.", status: "emerging" },
    ],
    sourceIds: ["medlineplus-stress"],
    doctorQuestion: "Is my level of stress something I should get support with?",
  },
  {
    id: "sittingHours",
    label: "Sitting time",
    unit: "hours/day",
    guidance: "WHO advises limiting sedentary time and replacing it with activity of any intensity.",
    weights: { cardiometabolic: 0.5, weight: 0.4 },
    align: (v) => {
      const h = Number(v);
      if (h <= 4) return 1;
      if (h <= 8) return 1 - ((h - 4) / 4) * 0.5;
      return clamp(0.5 - ((h - 8) / 4) * 0.3, 0.2, 0.5);
    },
    evidence: [{ text: "Long periods of sitting are associated with higher cardiometabolic risk, partly independent of exercise.", status: "established" }],
    sourceIds: ["who-activity"],
    doctorQuestion: "Are there simple ways to break up sitting time that suit my health?",
  },
];

export const FACTOR_BY_ID = new Map(FACTORS.map((f) => [f.id, f]));

export type Band = "within" | "approaching" | "outside";
export const bandOf = (a: number): Band => (a >= 0.75 ? "within" : a >= 0.5 ? "approaching" : "outside");

export const SIM_LIMITATIONS = [
  "This is an educational simulation, not a prediction. It cannot tell you what will happen to your health.",
  "It compares habits with public-health guidance and shows directions of association from population evidence. It does not calculate a probability or risk.",
  "It does not use your genetics, family history, medicines, lab results, or underlying conditions, all of which change how a person responds.",
  "Real-world changes depend on adherence, timing and many factors that are not captured here.",
  "Only a clinician who knows your history can judge what is appropriate for you.",
];
