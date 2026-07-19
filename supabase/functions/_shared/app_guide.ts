export type AppGuideItem = {
  guide_id: string;
  text: string;
};

export const APP_GUIDE_VERSION = "realdoor-app-guide-v1";

export const APP_GUIDE: readonly AppGuideItem[] = [
  {
    guide_id: "GUIDE-FLOW-001",
    text: "RealDoor has three phases: Profile to upload and confirm extracted values, Understand to inspect deterministic calculations and cited rules, and Prepare to review completeness and download a renter-controlled packet.",
  },
  {
    guide_id: "GUIDE-DOCUMENTS-001",
    text: "The default checklist asks for an application summary, a pay stub, and an employment letter. Benefit letters and gig statements may also be relevant when those income sources are present. Missing items do not hard-block the renter.",
  },
  {
    guide_id: "GUIDE-CONFIRM-001",
    text: "Only renter-confirmed, corrected, or renter-entered values are reused in downstream calculations. Extracted values awaiting review are excluded.",
  },
  {
    guide_id: "GUIDE-CORRECT-001",
    text: "A renter can return to Profile, correct a value, and immediately see the deterministic income, comparison, error count, and readiness information update.",
  },
  {
    guide_id: "GUIDE-PRIVACY-001",
    text: "The chat receives an allowlisted numeric and status summary. It does not receive uploaded files, raw OCR, names, addresses, filenames, file URLs, or quarantined document text.",
  },
  {
    guide_id: "GUIDE-DELETE-001",
    text: "Delete session removes the current browser-held documents and extracted values and displays a deletion proof with counts and time.",
  },
  {
    guide_id: "GUIDE-HANDOFF-001",
    text: "RealDoor prepares a file for human review and lets the renter download a packet. It does not submit the packet or make a program determination.",
  },
];
