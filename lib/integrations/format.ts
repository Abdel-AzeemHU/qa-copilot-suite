import type { BugReportSummary, IntegrationEvent, RunSummary } from "./types";

interface BugReportOutputLike {
  title?: string;
  summary?: string;
  severity?: string;
  expectedBehavior?: string;
  actualBehavior?: string;
}

function parseBugOutput(bugReport: BugReportSummary): BugReportOutputLike {
  try {
    return JSON.parse(bugReport.output) as BugReportOutputLike;
  } catch {
    return {};
  }
}

/** Plain-text/markdown summary used by Slack and generic webhook fallbacks. */
export function formatEventText(event: IntegrationEvent): string {
  switch (event.type) {
    case "run.completed":
      return formatRunCompletedText(event.run);
    case "bug.created":
      return formatBugCreatedText(event.bugReport);
    case "test":
      return event.message;
    case "testcases.generated":
      return `Generated ${event.testCases.length} test case(s)` + (event.sourceStoryKey ? ` for story ${event.sourceStoryKey}` : "");
    default:
      return "Integration event";
  }
}

export function formatRunCompletedText(run: RunSummary): string {
  const outcome = run.result ?? run.status;
  const emoji =
    outcome === "passed" ? "✅" : outcome === "failed" ? "❌" : "⚠️";
  const lines = [
    `${emoji} *Execution run ${run.id.slice(0, 8)} ${outcome}*`,
    `Target: ${run.targetUrl}`,
  ];
  if (run.errorMessage) {
    lines.push(`Error: ${run.errorMessage}`);
  }
  return lines.join("\n");
}

export function formatBugCreatedText(bugReport: BugReportSummary): string {
  const out = parseBugOutput(bugReport);
  const title = out.title ?? `Bug report ${bugReport.id.slice(0, 8)}`;
  const lines = [`🐞 *New bug report: ${title}*`];
  if (out.summary) lines.push(out.summary);
  if (out.severity) lines.push(`Severity: ${out.severity}`);
  return lines.join("\n");
}

export function bugReportTitleAndBody(bugReport: BugReportSummary): {
  title: string;
  body: string;
} {
  const out = parseBugOutput(bugReport);
  const title = out.title ?? `Bug report ${bugReport.id.slice(0, 8)}`;
  const bodyLines = [
    out.summary ?? "",
    "",
    out.severity ? `**Severity:** ${out.severity}` : "",
    "",
    "**Expected behavior**",
    out.expectedBehavior ?? "_Not provided_",
    "",
    "**Actual behavior**",
    out.actualBehavior ?? "_Not provided_",
    "",
    `_Filed automatically by Qaera (bug report ${bugReport.id})._`,
  ];
  return { title, body: bodyLines.filter((l) => l !== undefined).join("\n") };
}
