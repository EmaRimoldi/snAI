"use client";

import { useApp } from "@/lib/pipeline/state";
import type { Step } from "@/lib/pipeline/state";
import { useCopy } from "@/lib/pipeline/copy";
import s from "./pipeline.module.css";

export default function Stepper() {
  const c = useCopy();
  const { step, goToStep } = useApp();
  const steps: { id: Step; label: string }[] = [
    { id: "profile", label: c.step1 },
    { id: "understand", label: c.step2 },
    { id: "prepare", label: c.step3 },
  ];
  const activeIndex = steps.findIndex((x) => x.id === step);

  return (
    <nav aria-label={c.appTitle}>
      <ol className={s.stepper}>
        {steps.map((x, i) => {
          const isActive = x.id === step;
          const classes = [s.stepItem, isActive ? s.stepActive : "", i < activeIndex ? s.stepDone : ""]
            .filter(Boolean)
            .join(" ");
          return (
            <li key={x.id} style={{ flex: 1, display: "flex" }}>
              <button
                type="button"
                className={classes}
                aria-current={isActive ? "step" : undefined}
                onClick={() => goToStep(x.id)}
              >
                <span className={s.stepNum} aria-hidden="true">
                  {i + 1}
                </span>
                {x.label}
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
