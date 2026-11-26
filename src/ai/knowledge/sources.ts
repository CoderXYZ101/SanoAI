import type { SourceRef } from "../types";

/** Curated, reputable public-health references used by the RAG layer. Links point to the publisher's own pages. */
export const SOURCES: SourceRef[] = [
  { id: "ods-b12", title: "Vitamin B12 — Health Professional Fact Sheet", publisher: "NIH Office of Dietary Supplements", url: "https://ods.od.nih.gov/factsheets/VitaminB12-HealthProfessional/" },
  { id: "ods-vitd", title: "Vitamin D — Health Professional Fact Sheet", publisher: "NIH Office of Dietary Supplements", url: "https://ods.od.nih.gov/factsheets/VitaminD-HealthProfessional/" },
  { id: "ods-iron", title: "Iron — Health Professional Fact Sheet", publisher: "NIH Office of Dietary Supplements", url: "https://ods.od.nih.gov/factsheets/Iron-HealthProfessional/" },
  { id: "ods-folate", title: "Folate — Health Professional Fact Sheet", publisher: "NIH Office of Dietary Supplements", url: "https://ods.od.nih.gov/factsheets/Folate-HealthProfessional/" },
  { id: "ods-calcium", title: "Calcium — Health Professional Fact Sheet", publisher: "NIH Office of Dietary Supplements", url: "https://ods.od.nih.gov/factsheets/Calcium-HealthProfessional/" },
  { id: "medlineplus-anemia", title: "Anemia", publisher: "MedlinePlus (US National Library of Medicine)", url: "https://medlineplus.gov/anemia.html" },
  { id: "medlineplus-ferritin", title: "Ferritin Blood Test", publisher: "MedlinePlus (US National Library of Medicine)", url: "https://medlineplus.gov/lab-tests/ferritin-blood-test/" },
  { id: "who-anaemia", title: "Anaemia — Fact sheet", publisher: "World Health Organization", url: "https://www.who.int/news-room/fact-sheets/detail/anaemia" },
  { id: "medlineplus-hypothyroid", title: "Hypothyroidism", publisher: "MedlinePlus (US National Library of Medicine)", url: "https://medlineplus.gov/hypothyroidism.html" },
  { id: "medlineplus-diabetes", title: "Type 2 Diabetes", publisher: "MedlinePlus (US National Library of Medicine)", url: "https://medlineplus.gov/diabetestype2.html" },
  { id: "who-diabetes", title: "Diabetes — Fact sheet", publisher: "World Health Organization", url: "https://www.who.int/news-room/fact-sheets/detail/diabetes" },
  { id: "medlineplus-cholesterol", title: "Cholesterol", publisher: "MedlinePlus (US National Library of Medicine)", url: "https://medlineplus.gov/cholesterol.html" },
  { id: "who-cvd", title: "Cardiovascular diseases — Fact sheet", publisher: "World Health Organization", url: "https://www.who.int/news-room/fact-sheets/detail/cardiovascular-diseases-(cvds)" },
  { id: "who-hypertension", title: "Hypertension — Fact sheet", publisher: "World Health Organization", url: "https://www.who.int/news-room/fact-sheets/detail/hypertension" },
  { id: "medlineplus-hbp", title: "High Blood Pressure", publisher: "MedlinePlus (US National Library of Medicine)", url: "https://medlineplus.gov/highbloodpressure.html" },
  { id: "medlineplus-ckd", title: "Chronic Kidney Disease", publisher: "MedlinePlus (US National Library of Medicine)", url: "https://medlineplus.gov/chronickidneydisease.html" },
  { id: "medlineplus-chestpain", title: "Chest Pain", publisher: "MedlinePlus (US National Library of Medicine)", url: "https://medlineplus.gov/chestpain.html" },
  { id: "medlineplus-arrhythmia", title: "Arrhythmia (Heart Rhythm Problems)", publisher: "MedlinePlus (US National Library of Medicine)", url: "https://medlineplus.gov/arrhythmia.html" },
  { id: "medlineplus-fatigue", title: "Fatigue", publisher: "MedlinePlus (US National Library of Medicine)", url: "https://medlineplus.gov/fatigue.html" },
  { id: "medlineplus-migraine", title: "Migraine", publisher: "MedlinePlus (US National Library of Medicine)", url: "https://medlineplus.gov/migraine.html" },
  { id: "medlineplus-gerd", title: "GERD", publisher: "MedlinePlus (US National Library of Medicine)", url: "https://medlineplus.gov/gerd.html" },
  { id: "medlineplus-ibs", title: "Irritable Bowel Syndrome", publisher: "MedlinePlus (US National Library of Medicine)", url: "https://medlineplus.gov/irritablebowelsyndrome.html" },
  { id: "medlineplus-celiac", title: "Celiac Disease", publisher: "MedlinePlus (US National Library of Medicine)", url: "https://medlineplus.gov/celiacdisease.html" },
  { id: "medlineplus-asthma", title: "Asthma", publisher: "MedlinePlus (US National Library of Medicine)", url: "https://medlineplus.gov/asthma.html" },
  { id: "medlineplus-sleep", title: "Healthy Sleep", publisher: "MedlinePlus (US National Library of Medicine)", url: "https://medlineplus.gov/healthysleep.html" },
  { id: "cdc-sleep", title: "About Sleep", publisher: "US Centers for Disease Control and Prevention", url: "https://www.cdc.gov/sleep/about/index.html" },
  { id: "who-activity", title: "Physical activity — Fact sheet", publisher: "World Health Organization", url: "https://www.who.int/news-room/fact-sheets/detail/physical-activity" },
  { id: "who-diet", title: "Healthy diet — Fact sheet", publisher: "World Health Organization", url: "https://www.who.int/news-room/fact-sheets/detail/healthy-diet" },
  { id: "who-alcohol", title: "Alcohol — Fact sheet", publisher: "World Health Organization", url: "https://www.who.int/news-room/fact-sheets/detail/alcohol" },
  { id: "who-dengue", title: "Dengue and severe dengue — Fact sheet", publisher: "World Health Organization", url: "https://www.who.int/news-room/fact-sheets/detail/dengue-and-severe-dengue" },
  { id: "who-tb", title: "Tuberculosis — Fact sheet", publisher: "World Health Organization", url: "https://www.who.int/news-room/fact-sheets/detail/tuberculosis" },
  { id: "who-typhoid", title: "Typhoid — Fact sheet", publisher: "World Health Organization", url: "https://www.who.int/news-room/fact-sheets/detail/typhoid" },
  { id: "who-tobacco", title: "Tobacco — Fact sheet", publisher: "World Health Organization", url: "https://www.who.int/news-room/fact-sheets/detail/tobacco" },
  { id: "medlineplus-stress", title: "Stress", publisher: "MedlinePlus (US National Library of Medicine)", url: "https://medlineplus.gov/stress.html" },
  { id: "medlineplus-neuropathy", title: "Peripheral Nerve Disorders", publisher: "MedlinePlus (US National Library of Medicine)", url: "https://medlineplus.gov/peripheralnervedisorders.html" },
  { id: "medlineplus-osteoporosis", title: "Osteoporosis", publisher: "MedlinePlus (US National Library of Medicine)", url: "https://medlineplus.gov/osteoporosis.html" },
  { id: "medlineplus-drugallergy", title: "Drug Allergy", publisher: "MedlinePlus (US National Library of Medicine)", url: "https://medlineplus.gov/drugallergy.html" },
  { id: "medlineplus-labtests", title: "Lab Tests Online — Reference ranges and test results", publisher: "MedlinePlus (US National Library of Medicine)", url: "https://medlineplus.gov/lab-tests/understanding-your-lab-results/" },
  { id: "medlineplus-dietaryfats", title: "Dietary Fats", publisher: "MedlinePlus (US National Library of Medicine)", url: "https://medlineplus.gov/dietaryfats.html" },
  { id: "medlineplus-fever", title: "Fever — Medical Encyclopedia", publisher: "MedlinePlus (US National Library of Medicine)", url: "https://medlineplus.gov/ency/article/003090.htm" },
  { id: "medlineplus-cold", title: "Common Cold", publisher: "MedlinePlus (US National Library of Medicine)", url: "https://medlineplus.gov/commoncold.html" },
  { id: "medlineplus-dehydration", title: "Dehydration", publisher: "MedlinePlus (US National Library of Medicine)", url: "https://medlineplus.gov/dehydration.html" },
  { id: "who-obesity", title: "Obesity and overweight — Fact sheet", publisher: "World Health Organization", url: "https://www.who.int/news-room/fact-sheets/detail/obesity-and-overweight" },
  { id: "dailymed", title: "DailyMed — official drug labels", publisher: "US National Library of Medicine", url: "https://dailymed.nlm.nih.gov/dailymed/" },
  { id: "medlineplus-drugs", title: "Drugs, Herbs and Supplements", publisher: "MedlinePlus (US National Library of Medicine)", url: "https://medlineplus.gov/druginformation.html" },
];

export const SOURCE_BY_ID = new Map(SOURCES.map((s) => [s.id, s]));
export const sourcesFor = (ids: string[]): SourceRef[] =>
  Array.from(new Set(ids))
    .map((id) => SOURCE_BY_ID.get(id))
    .filter((s): s is SourceRef => !!s);
