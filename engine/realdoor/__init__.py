"""RealDoor hackathon solution package.

Block map (see solution/README.md for ownership):
    config.py / models.py     Block 0  shared contracts
    extract/                  Blocks A1-A3  PDF -> DocumentRecord (Person 1)
    calc.py                   Block B  deterministic income + threshold engine
    readiness.py              Block C  readiness reasons + status
    safety.py                 Block D  injection guard, refusals, decision lint
    rules.py, citations.py    citation plumbing
    pipeline.py, qa.py        Block E  end-to-end assembly + QA answers
"""
