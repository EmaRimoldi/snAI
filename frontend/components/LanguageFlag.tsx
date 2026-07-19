import type { Language } from "@/lib/i18n";

type LanguageFlagProps = {
  language: Language;
};

/* Pentagram star centered on the origin with outer radius 1 (nonzero fill). */
const STAR = "M0 -1 L0.588 0.809 L-0.951 -0.309 L0.951 -0.309 L-0.588 0.809 Z";

/**
 * Simplified flag for the currently selected language, rendered as inline SVG
 * so it looks identical on every OS (emoji flags do not render on Windows).
 * Decorative only — the surrounding control provides the accessible name.
 */
export default function LanguageFlag({ language }: LanguageFlagProps) {
  return (
    <svg className="flag-icon" viewBox="0 0 20 14" aria-hidden="true" focusable="false">
      {language === "en" && (
        <>
          <rect width="20" height="14" fill="#ffffff" />
          {[0, 1, 2, 3, 4, 5, 6].map((index) => (
            <rect
              key={index}
              y={(index * 14) / 6.5}
              width="20"
              height={14 / 13}
              fill="#b22234"
            />
          ))}
          <rect width="8.5" height="7.54" fill="#3c3b6e" />
        </>
      )}
      {language === "es" && (
        <>
          <rect width="20" height="14" fill="#aa151b" />
          <rect y="3.5" width="20" height="7" fill="#f1bf00" />
        </>
      )}
      {language === "zh" && (
        <>
          <rect width="20" height="14" fill="#ee1c25" />
          <path d={STAR} fill="#ffde00" transform="translate(3.4 3.8) scale(2.1)" />
          <path d={STAR} fill="#ffde00" transform="translate(7 1.4) scale(0.7)" />
          <path d={STAR} fill="#ffde00" transform="translate(8.2 3.2) scale(0.7)" />
          <path d={STAR} fill="#ffde00" transform="translate(8.2 5.4) scale(0.7)" />
          <path d={STAR} fill="#ffde00" transform="translate(7 7.2) scale(0.7)" />
        </>
      )}
      {language === "tl" && (
        <>
          <rect width="20" height="7" fill="#0038a8" />
          <rect y="7" width="20" height="7" fill="#ce1126" />
          <polygon points="0,0 8,7 0,14" fill="#ffffff" />
          <circle cx="2.9" cy="7" r="1.5" fill="#fcd116" />
        </>
      )}
      {language === "vi" && (
        <>
          <rect width="20" height="14" fill="#da251d" />
          <path d={STAR} fill="#ffff00" transform="translate(10 7.4) scale(3.2)" />
        </>
      )}
    </svg>
  );
}
