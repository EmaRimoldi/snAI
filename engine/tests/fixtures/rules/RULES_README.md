# Frozen RealDoor challenge rules

This corpus freezes one narrow simulation for the event date **2026-07-18**. It combines cited official facts with clearly labeled hackathon conventions. It is not legal advice and is not a substitute for an owner, allocating agency, or compliance professional's current procedures.

## Scored task

1. Extract normalized fields with page and source-box citations.
2. Annualize recurring gross income using the stated frequency.
3. Compare it with the **60% AMI** frozen threshold for household size 1-8.
4. Return `READY_TO_REVIEW` or `NEEDS_REVIEW`; never make an eligibility decision.
5. A document is current for this simulation when dated no more than 60 days before 2026-07-18. This is a challenge convention, not a universal LIHTC rule.

## Official sources

- HUD FY 2026 MTSP: https://www.huduser.gov/portal/datasets/mtsp.html
- HUD FY 2026 report: https://www.huduser.gov/portal/datasets/mtsp/mtsp26/HERA-Income-Limits-Report-FY26.pdf
- HUD LIHTC property data: https://www.huduser.gov/portal/datasets/lihtc/property.html
- Federal statute: https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title26-section42&num=0&edition=prelim
- Federal compliance-monitoring regulation: https://www.ecfr.gov/current/title-26/section-1.42-5
