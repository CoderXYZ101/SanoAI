/**
 * DEMONSTRATION DIRECTORY (India) — every person and pharmacy below is FICTIONAL.
 * No credentials are verified, no availability is live, and no appointment or enquiry is ever
 * transmitted. Replace with a real directory/booking integration when one is available.
 */

export interface DemoDoctor {
  id: string;
  name: string;
  specialty: string;
  focus: string;
  city: string;
  country: string;
  languages: string[];
  qualifications: string; // fictional and unverified
  experienceYears: number;
  modes: ("In person" | "Video" | "Phone")[];
  about: string;
}

const d = (
  id: string,
  name: string,
  specialty: string,
  focus: string,
  city: string,
  state: string,
  languages: string[],
  qualifications: string,
  experienceYears: number,
  modes: DemoDoctor["modes"],
  about: string,
): DemoDoctor => ({ id, name, specialty, focus, city, country: state, languages, qualifications, experienceYears, modes, about });

export const DEMO_DOCTORS: DemoDoctor[] = [
  d("demo-doc-01", "Dr. Amara Sample", "General Medicine", "Preventive care and chronic disease coordination", "Chennai", "Tamil Nadu", ["English", "Tamil"], "MBBS (demo), MD General Medicine (demo)", 14, ["In person", "Video"], "Fictional profile. Coordinates care across specialties and reviews blood results."),
  d("demo-doc-02", "Dr. Ravi Example", "Cardiology", "Hypertension and rhythm disorders", "Mumbai", "Maharashtra", ["English", "Hindi", "Marathi"], "MBBS (demo), DM Cardiology (demo)", 18, ["In person", "Video"], "Fictional profile. Sees patients with palpitations, blood pressure and cholesterol questions."),
  d("demo-doc-03", "Dr. Leena Placeholder", "Endocrinology", "Diabetes, thyroid and bone health", "Bengaluru", "Karnataka", ["English", "Kannada", "Hindi"], "MBBS (demo), DM Endocrinology (demo)", 11, ["In person", "Video", "Phone"], "Fictional profile. Focus on diabetes care and thyroid disorders."),
  d("demo-doc-04", "Dr. Omar Demo", "Haematology", "Anaemia and iron disorders", "Hyderabad", "Telangana", ["English", "Telugu", "Urdu"], "MBBS (demo), DM Haematology (demo)", 16, ["In person", "Video"], "Fictional profile. Investigates unexplained anaemia and low iron stores."),
  d("demo-doc-05", "Dr. Priya Fictional", "Gastroenterology", "Reflux, coeliac and bowel conditions", "New Delhi", "Delhi", ["English", "Hindi"], "MBBS (demo), DM Gastroenterology (demo)", 13, ["In person", "Video"], "Fictional profile. Sees digestive symptoms and nutrient-absorption questions."),
  d("demo-doc-06", "Dr. Arjun Sampleton", "Neurology", "Neuropathy and headache", "Kolkata", "West Bengal", ["English", "Bengali", "Hindi"], "MBBS (demo), DM Neurology (demo)", 12, ["In person", "Video"], "Fictional profile. Evaluates numbness, tingling and headache disorders."),
  d("demo-doc-07", "Dr. Nadia Mockwood", "Nutrition & Dietetics", "Clinical nutrition and micronutrient deficiencies", "Pune", "Maharashtra", ["English", "Hindi", "Marathi"], "MSc Clinical Nutrition (demo), RD (demo)", 9, ["Video", "Phone"], "Fictional profile. Helps interpret vitamin and mineral results with diet history, including vegetarian diets."),
  d("demo-doc-08", "Dr. Manoj Testwell", "Nephrology", "Kidney function in diabetes and hypertension", "Kochi", "Kerala", ["English", "Malayalam"], "MBBS (demo), DM Nephrology (demo)", 15, ["In person", "Video"], "Fictional profile. Reviews creatinine, eGFR and urine tests."),
  d("demo-doc-09", "Dr. Esha Illustrative", "General Medicine", "Women's health and primary care", "Ahmedabad", "Gujarat", ["English", "Gujarati", "Hindi"], "MBBS (demo), DNB Family Medicine (demo)", 10, ["In person", "Video"], "Fictional profile. Primary care physician focused on whole-person care."),
  d("demo-doc-10", "Dr. Farid Specimen", "Cardiology", "Preventive cardiology and lipid clinic", "Lucknow", "Uttar Pradesh", ["English", "Hindi", "Urdu"], "MBBS (demo), DM Cardiology (demo)", 17, ["In person", "Phone"], "Fictional profile. Cholesterol management and cardiovascular risk assessment."),
  d("demo-doc-11", "Dr. Simran Prototype", "Endocrinology", "Thyroid and metabolic medicine", "Chandigarh", "Punjab", ["English", "Punjabi", "Hindi"], "MBBS (demo), DNB Endocrinology (demo)", 12, ["Video"], "Fictional profile. Thyroid disorders and metabolic health."),
  d("demo-doc-12", "Dr. Harsh Notreal", "Gastroenterology", "Nutrient absorption and inflammatory bowel conditions", "Jaipur", "Rajasthan", ["English", "Hindi"], "MBBS (demo), DM Gastroenterology (demo)", 14, ["In person", "Video"], "Fictional profile."),
];

export interface DemoPharmacy {
  id: string;
  name: string;
  city: string;
  country: string;
  address: string;
  services: string[];
  note: string;
}
const p = (id: string, name: string, city: string, state: string, services: string[]): DemoPharmacy => ({
  id,
  name,
  city,
  country: state,
  address: "Demonstration listing — not a real address",
  services,
  note: "Fictional pharmacy. Stock, hours and contact details are not live.",
});

export const DEMO_PHARMACIES: DemoPharmacy[] = [
  p("demo-ph-01", "Demo CarePoint Medicals", "Chennai", "Tamil Nadu", ["Prescription dispensing", "Medicine counselling"]),
  p("demo-ph-02", "Sample Wellness Chemist", "Mumbai", "Maharashtra", ["Prescription dispensing", "Home delivery"]),
  p("demo-ph-03", "Placeholder Health Pharmacy", "Bengaluru", "Karnataka", ["Prescription dispensing", "Medicine counselling", "Home delivery"]),
  p("demo-ph-04", "Example Medical Hall", "Hyderabad", "Telangana", ["Prescription dispensing"]),
  p("demo-ph-05", "Mockwood Medical Store", "New Delhi", "Delhi", ["Prescription dispensing", "Medicine counselling"]),
  p("demo-ph-06", "Illustrative Generic Medicine Store", "Pune", "Maharashtra", ["Generic medicines", "Prescription dispensing"]),
  p("demo-ph-07", "Prototype Medicals", "Kochi", "Kerala", ["Prescription dispensing", "Medicine counselling"]),
  p("demo-ph-08", "Specimen Drug House", "Kolkata", "West Bengal", ["Prescription dispensing"]),
];
