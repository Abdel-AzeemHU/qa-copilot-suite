export interface ExportableTestCase {
  title: string;
  preconditions: string | null;
  steps: string; // JSON-encoded string[]
  expectedResult: string | null;
  priority: string;
  type: string;
  requirement: string | null;
}

function parseSteps(steps: string): string[] {
  try {
    const parsed: unknown = JSON.parse(steps);
    if (Array.isArray(parsed)) {
      return parsed.filter((s): s is string => typeof s === "string");
    }
  } catch {
    // fall through
  }
  return [];
}

function csvEscape(value: string): string {
  if (/[",\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function toCsv(testCases: ExportableTestCase[]): string {
  const header = [
    "Title",
    "Type",
    "Priority",
    "Preconditions",
    "Steps",
    "Expected Result",
    "Requirement",
  ];
  const rows = testCases.map((tc) =>
    [
      tc.title,
      tc.type,
      tc.priority,
      tc.preconditions ?? "",
      parseSteps(tc.steps).join(" | "),
      tc.expectedResult ?? "",
      tc.requirement ?? "",
    ]
      .map((v) => csvEscape(v))
      .join(","),
  );
  return [header.join(","), ...rows].join("\n");
}

export function toGherkin(
  testCases: ExportableTestCase[],
  featureName: string,
): string {
  const lines: string[] = [`Feature: ${featureName}`, ""];
  for (const tc of testCases) {
    lines.push(`  # Priority: ${tc.priority} | Type: ${tc.type}`);
    lines.push(`  Scenario: ${tc.title}`);
    if (tc.preconditions) {
      lines.push(`    Given ${tc.preconditions}`);
    }
    const steps = parseSteps(tc.steps);
    steps.forEach((step, idx) => {
      const keyword = idx === 0 ? "When" : "And";
      lines.push(`    ${keyword} ${step}`);
    });
    if (tc.expectedResult) {
      lines.push(`    Then ${tc.expectedResult}`);
    }
    lines.push("");
  }
  return lines.join("\n");
}
