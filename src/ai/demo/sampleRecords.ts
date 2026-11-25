import type { DocType } from "../types";

/**
 * SYNTHETIC DEMONSTRATION RECORDS — a fictional patient, invented for this app.
 * They are deliberately constructed so every SanoAI module has something to show
 * (ambiguous dates, repeated abnormal results, an advised test with no result,
 * and statements that conflict across documents). They are never real medical data.
 */
export interface SampleDoc {
  title: string;
  docType: DocType;
  fileName: string;
  text: string;
}

export const SAMPLE_DOCS: SampleDoc[] = [
  {
    title: "Blood test report — Feb 2024",
    docType: "lab_report",
    fileName: "demo-blood-report-feb-2024.txt",
    text: `DEMO LABORATORIES — SAMPLE REPORT (synthetic data · fictional patient · not a real record)
Patient: Sample Patient    Age/Sex: 52 / F
Referred by: Dr. A. Sample (General Medicine)
Sample collected: 14 February 2024
Report date: 15 February 2024

COMPLETE BLOOD COUNT
Haemoglobin        10.8   g/dL    (12.0 - 15.5)   LOW
MCV                78     fL      (80 - 100)      LOW

VITAMINS & MINERALS
Vitamin B12        190    pg/mL   (200 - 900)     LOW
25-OH Vitamin D    17     ng/mL   (30 - 100)      LOW
Calcium            9.1    mg/dL   (8.6 - 10.2)
Folate             8.2    ng/mL   (> 4.0)

THYROID
TSH                5.9    mIU/L   (0.4 - 4.0)     HIGH

METABOLIC
Fasting Glucose    118    mg/dL   (70 - 99)       HIGH
LDL Cholesterol    162    mg/dL   (< 130)         HIGH

Comments: Please correlate clinically.
`,
  },
  {
    title: "Cardiology consultation — Mar 2024",
    docType: "consultation",
    fileName: "demo-cardiology-consult-mar-2024.txt",
    text: `Dept. of Cardiology — Outpatient Consultation Summary
(SAMPLE DOCUMENT — fictional patient, synthetic data)
Consultation date: 04/03/2024
Patient: Sample Patient, 52 F
Referred by: General Medicine

Presenting complaints: Patient reports palpitations for the past 3 weeks, persistent fatigue and mild shortness of breath on climbing stairs. Denies chest pain.
Examination: BP 148/92 mmHg. Pulse 84/min, regular.
Investigations: ECG performed today — sinus rhythm, no acute changes.
Impression:
1. Elevated blood pressure — to be confirmed on repeat readings
2. Palpitations, cause not yet established
Plan: Holter monitoring advised. Lipid profile to be reviewed.
Medications: Amlodipine 5 mg once daily (started today)
Follow up in 6 weeks with Holter report.
`,
  },
  {
    title: "Endocrinology clinic note — Mar 2024",
    docType: "consultation",
    fileName: "demo-endocrinology-note-mar-2024.txt",
    text: `Dr. L. Placeholder — Endocrinology & Diabetes Clinic
(SAMPLE DOCUMENT — fictional patient, synthetic data)
Date: 20 March 2024
Patient: Sample Patient, 52 F

History: Reports tingling in both feet for about two months and ongoing tiredness.
Allergies: Penicillin (rash)
Diagnosis: Type 2 diabetes mellitus (newly diagnosed)

Prescription:
Tab. Metformin 500 mg twice daily with meals

Advice: Dietary counselling and regular walking. Repeat blood sugar tests in 3 months.
`,
  },
  {
    title: "Blood test report — Sep 2024",
    docType: "lab_report",
    fileName: "demo-blood-report-sep-2024.txt",
    text: `DEMO LABORATORIES — SAMPLE REPORT (synthetic data · fictional patient · not a real record)
Patient: Sample Patient    Age/Sex: 52 / F
Referred by: Dr. L. Placeholder (Endocrinology)
Sample collected: 12 September 2024
Report date: 13 September 2024

HAEMATOLOGY
Haemoglobin        11.4   g/dL    (12.0 - 15.5)   LOW
MCV                79     fL      (80 - 100)      LOW
Ferritin           11     ng/mL   (15 - 150)      LOW

VITAMINS & MINERALS
Vitamin B12        198    pg/mL   (200 - 900)     LOW
25-OH Vitamin D    24     ng/mL   (30 - 100)      LOW
Calcium            9.3    mg/dL   (8.6 - 10.2)
Folate             9.0    ng/mL   (> 4.0)

THYROID
TSH                6.4    mIU/L   (0.4 - 4.0)     HIGH

DIABETES MONITORING
HbA1c              6.9    %       (4.0 - 5.6)     HIGH
Fasting Glucose    126    mg/dL   (70 - 99)       HIGH

KIDNEY & LIPIDS
Creatinine         0.9    mg/dL   (0.6 - 1.1)
LDL Cholesterol    148    mg/dL   (< 130)         HIGH
`,
  },
  {
    title: "Hospital discharge summary — Nov 2024",
    docType: "discharge",
    fileName: "demo-discharge-summary-nov-2024.txt",
    text: `DEMO GENERAL HOSPITAL — DISCHARGE SUMMARY
(SAMPLE DOCUMENT — fictional patient, synthetic data)
Patient: Sample Patient, 52 F
Date of admission: 02/11/2024
Date of discharge: 3 November 2024
Reason for admission: Chest discomfort and a urinary tract infection.
Past history: No known diabetes. Not on any regular medication.
Allergies: Nil known
Diagnosis: Urinary tract infection; Non-cardiac chest discomfort

Medications on discharge:
Amoxicillin 500 mg three times daily for 5 days
Amlodipine 5 mg once daily

Follow-up: Review with GP in 1 week.
`,
  },
];
