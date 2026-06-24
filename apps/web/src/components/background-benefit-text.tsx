"use client";

import { SrdHint } from "@/components/srd-hint";
import { CodexRefLink } from "@/components/codex-ref-link";
import {
  segmentBenefitDescription,
  type CodexLinkIndex,
} from "@/lib/codex-background-benefit-links";

export function BackgroundBenefitText({
  desc,
  benefitType,
  linkIndex,
  onNavigate,
}: {
  desc: string;
  benefitType: string | null | undefined;
  linkIndex: CodexLinkIndex;
  onNavigate?: () => void;
}) {
  const segments = segmentBenefitDescription(desc, benefitType, linkIndex);

  return (
    <p className="mt-1.5 whitespace-pre-wrap text-sm leading-relaxed text-lore-muted">
      {segments.map((segment, i) => {
        if (segment.kind === "text") {
          return <span key={i}>{segment.text}</span>;
        }
        if (segment.kind === "codex") {
          return (
            <CodexRefLink
              key={i}
              category={segment.category}
              slug={segment.slug}
              label={segment.text}
              preview={segment.preview}
              onNavigate={onNavigate}
            />
          );
        }
        if (segment.kind === "skill") {
          return (
            <span key={i} className="inline-flex items-center">
              <SrdHint kind="skill" skill={segment.skill} label={segment.text} />
            </span>
          );
        }
        return (
          <span key={i} className="inline-flex items-center">
            <SrdHint
              kind="ability"
              ability={segment.ability}
              label={segment.text}
            />
          </span>
        );
      })}
    </p>
  );
}
