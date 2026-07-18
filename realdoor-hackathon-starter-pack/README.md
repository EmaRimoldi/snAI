# RealDoor Hack-Nation participant starter pack

**Status: DRAFT — organizer approval required before external distribution.**

This pack contains a source-backed, frozen challenge simulation for the Boston-Cambridge-Quincy, MA-NH HUD Metro FMR Area. It is designed for application-readiness tooling, not automated housing decisions.

## Inventory

- 32 public HUD LIHTC project records with a field dictionary
- FY 2026 50% context and 60% scored MTSP limits for household sizes 1-8
- 24 synthetic one-page PDF documents across 6 fictional households
- Gold fields with page-level PDF-point source boxes
- 36 gold Q&A records and 24 adversarial tests
- Standard-library Python starter code, schemas, and tests
- Data/model/code license manifest and organizer release checklist

## First steps

1. Read `participant-guide/RealDoor_Starter_Pack_Guide.pdf`.
2. Read `rules/RULES_README.md` and `governance/DATA_USE_AND_SAFETY.md`.
3. From `starter/`, run `python -m unittest discover -s tests -v`.
4. Use the supplied schemas and cite page/source boxes in every material output.

## Non-negotiable boundary

Do not determine eligibility, approval, denial, priority, or current property availability. The challenge output is evidence extraction, deterministic calculation, threshold comparison, document readiness, and human-review handoff.

## Source snapshot

- HUD FY 2026 MTSP effective date: 2026-05-01
- HUD LIHTC ArcGIS layer retrieval date: 2026-07-18
- Public property records are a teaching subset, not a complete metro inventory
- No real applicant data or real private documents are included
