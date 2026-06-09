/**
 * DOM candidate extraction utility for selector healing.
 * This module runs INSIDE the spawned Node.js test script via inline injection.
 * It is also importable for testing.
 */

export interface DomCandidate {
  tag: string;
  id?: string;
  testId?: string;
  role?: string;
  ariaLabel?: string;
  placeholder?: string;
  text?: string;
  classes?: string;
}

/**
 * Score a candidate element for relevance to the broken selector.
 * Higher score = more likely to be the intended element.
 */
export function scoreCandidateRelevance(
  candidate: DomCandidate,
  brokenSelector: string,
): number {
  const needle = brokenSelector.toLowerCase();
  let score = 0;

  const fields = [
    candidate.id,
    candidate.testId,
    candidate.text,
    candidate.ariaLabel,
    candidate.placeholder,
    candidate.classes,
  ].filter(Boolean) as string[];

  for (const field of fields) {
    const f = field.toLowerCase();
    if (f === needle) score += 10;
    else if (f.includes(needle)) score += 5;
    else {
      // Check token overlap
      const tokens = needle.replace(/[#.\[\]"=*^$~|]/g, " ").split(/\s+/).filter(Boolean);
      for (const token of tokens) {
        if (f.includes(token)) score += 2;
      }
    }
  }

  // Prefer elements with stable attributes
  if (candidate.testId) score += 3;
  if (candidate.role) score += 2;
  if (candidate.ariaLabel) score += 2;
  if (candidate.id) score += 1;

  return score;
}

/**
 * Sort and return top N candidates by relevance to broken selector.
 */
export function selectTopCandidates(
  candidates: DomCandidate[],
  brokenSelector: string,
  maxCandidates = 30,
): DomCandidate[] {
  return candidates
    .map((c) => ({ candidate: c, score: scoreCandidateRelevance(c, brokenSelector) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, maxCandidates)
    .map((x) => x.candidate);
}

/**
 * Extract DOM candidates from a Playwright page.
 * This function signature is compatible with playwright.Page.
 */
export async function extractDomCandidates(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  page: any,
  selector: string,
  maxCandidates = 30,
): Promise<DomCandidate[]> {
  const raw: DomCandidate[] = await page.evaluate(() => {
    const TAILWIND_PATTERN = /^(flex|grid|block|inline|hidden|text-|bg-|border|p-|m-|w-|h-|rounded|shadow|font-|leading-|tracking-|space-|gap-|items-|justify-|overflow-|z-|opacity-|transition-|hover:|focus:|sm:|md:|lg:|xl:)/;

    function getClasses(el: Element): string {
      const cls = Array.from(el.classList)
        .filter((c) => !TAILWIND_PATTERN.test(c))
        .slice(0, 3)
        .join(" ")
        .trim();
      return cls;
    }

    function getText(el: Element): string {
      const t = (el as HTMLElement).innerText?.trim() ?? "";
      return t.slice(0, 80);
    }

    const elements = document.querySelectorAll(
      "a, button, input, select, textarea, [role], [data-testid], [data-test], [data-cy], [aria-label]",
    );

    return Array.from(elements).map((el) => {
      const candidate: Record<string, string | undefined> = {
        tag: el.tagName.toLowerCase(),
      };
      const id = el.getAttribute("id");
      if (id) candidate.id = id;
      const testId =
        el.getAttribute("data-testid") ??
        el.getAttribute("data-test") ??
        el.getAttribute("data-cy") ??
        undefined;
      if (testId) candidate.testId = testId;
      const role = el.getAttribute("role");
      if (role) candidate.role = role;
      const ariaLabel = el.getAttribute("aria-label");
      if (ariaLabel) candidate.ariaLabel = ariaLabel;
      const placeholder = el.getAttribute("placeholder");
      if (placeholder) candidate.placeholder = placeholder;
      const text = getText(el);
      if (text) candidate.text = text;
      const classes = getClasses(el);
      if (classes) candidate.classes = classes;
      return candidate;
    });
  });

  return selectTopCandidates(raw, selector, maxCandidates);
}
