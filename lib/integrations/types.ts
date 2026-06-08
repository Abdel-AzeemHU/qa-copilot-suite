// Shared types for the integrations dispatch system.

export interface RunSummary {
  id: string;
  projectId: string;
  status: string;
  result: string | null;
  targetUrl: string;
  errorMessage?: string | null;
}

export interface BugReportSummary {
  id: string;
  projectId: string;
  output: string; // JSON-encoded BugReporterOutput-ish blob
}

export type IntegrationEvent =
  | { type: "run.completed"; run: RunSummary }
  | { type: "bug.created"; bugReport: BugReportSummary }
  | { type: "test"; message: string };

export interface IntegrationRecord {
  id: string;
  projectId: string;
  type: string;
  name: string;
  config: string;
  encryptedSecret: string | null;
  enabled: boolean;
}

export interface DispatchResult {
  status: "success" | "error";
  error?: string;
}
