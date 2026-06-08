import { decrypt } from "@/lib/crypto";
import { bugReportTitleAndBody } from "./format";
import type {
  DispatchResult,
  IntegrationEvent,
  IntegrationRecord,
} from "./types";

/**
 * Creates a GitHub Issue for `bug.created` events via the REST API, using a
 * stored personal access token. Other event types are no-ops (success).
 */
export async function dispatchGithub(
  integration: IntegrationRecord,
  event: IntegrationEvent,
): Promise<DispatchResult> {
  if (event.type !== "bug.created") {
    return { status: "success" };
  }

  if (!integration.encryptedSecret) {
    return { status: "error", error: "GitHub integration is missing a personal access token" };
  }

  let config: { repo?: string; owner?: string } = {};
  try {
    config = JSON.parse(integration.config) as { repo?: string; owner?: string };
  } catch {
    return { status: "error", error: "GitHub integration has invalid config" };
  }

  const repoSpec = config.repo ?? (config.owner ? `${config.owner}` : "");
  const [owner, repo] = repoSpec.includes("/")
    ? repoSpec.split("/")
    : [config.owner, config.repo];

  if (!owner || !repo) {
    return {
      status: "error",
      error: 'GitHub integration config must include "repo" as "owner/repo"',
    };
  }

  let token: string;
  try {
    token = decrypt(integration.encryptedSecret);
  } catch {
    return { status: "error", error: "Failed to decrypt GitHub token" };
  }

  const { title, body } = bugReportTitleAndBody(event.bugReport);

  try {
    const res = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/issues`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/vnd.github+json",
          "Content-Type": "application/json",
          "X-GitHub-Api-Version": "2022-11-28",
        },
        body: JSON.stringify({ title, body }),
      },
    );

    if (!res.ok) {
      const errBody = await res.text().catch(() => "");
      return {
        status: "error",
        error: `GitHub API responded with ${res.status}: ${errBody.slice(0, 300)}`,
      };
    }

    return { status: "success" };
  } catch (err) {
    return {
      status: "error",
      error: err instanceof Error ? err.message : "Failed to reach GitHub API",
    };
  }
}
