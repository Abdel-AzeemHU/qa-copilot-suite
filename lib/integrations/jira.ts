// Jira Cloud REST API v3 adapter.

export interface JiraConfig {
  domain: string;    // e.g. "mycompany" (no .atlassian.net)
  projectKey: string;
  email: string;
}

export interface JiraStory {
  id: string;
  key: string;
  summary: string;
  description: string | null;
  status: string;
  issueType: string;
}

function basicAuth(email: string, token: string): string {
  return "Basic " + Buffer.from(`${email}:${token}`).toString("base64");
}

function baseUrl(domain: string): string {
  return `https://${domain}.atlassian.net/rest/api/3`;
}

/**
 * Fetches Stories and Epics from the configured Jira project.
 */
export async function fetchJiraStories(
  config: JiraConfig,
  decryptedToken: string,
): Promise<JiraStory[]> {
  const jql = `project=${config.projectKey} AND issuetype in (Story,Epic) ORDER BY created DESC`;
  const url =
    `${baseUrl(config.domain)}/search?` +
    new URLSearchParams({ jql, maxResults: "50", fields: "summary,description,status,issuetype" });

  const res = await fetch(url, {
    headers: {
      Authorization: basicAuth(config.email, decryptedToken),
      Accept: "application/json",
    },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Jira API error ${res.status}: ${text}`);
  }
  const data = (await res.json()) as {
    issues: Array<{
      id: string;
      key: string;
      fields: {
        summary: string;
        description: { content?: Array<{ content?: Array<{ text?: string }> }> } | null;
        status: { name: string };
        issuetype: { name: string };
      };
    }>;
  };

  return (data.issues ?? []).map((issue) => ({
    id: issue.id,
    key: issue.key,
    summary: issue.fields.summary,
    description: extractDescription(issue.fields.description),
    status: issue.fields.status.name,
    issueType: issue.fields.issuetype.name,
  }));
}

function extractDescription(
  desc: { content?: Array<{ content?: Array<{ text?: string }> }> } | null,
): string | null {
  if (!desc) return null;
  const texts: string[] = [];
  for (const block of desc.content ?? []) {
    for (const inline of block.content ?? []) {
      if (inline.text) texts.push(inline.text);
    }
  }
  return texts.join(" ") || null;
}

/**
 * Creates sub-tasks on a Jira story for each test case, or adds a comment if sub-tasks fail.
 */
export async function pushTestCasesToJira(
  config: JiraConfig,
  token: string,
  storyKey: string,
  testCases: Array<{ title: string; steps?: string[]; expectedResult?: string | null }>,
): Promise<void> {
  const auth = basicAuth(config.email, token);
  const base = baseUrl(config.domain);

  // Try sub-tasks first
  for (const tc of testCases) {
    const body = {
      fields: {
        project: { key: config.projectKey },
        parent: { key: storyKey },
        summary: tc.title,
        issuetype: { name: "Sub-task" },
        description: {
          type: "doc",
          version: 1,
          content: [
            {
              type: "paragraph",
              content: [
                {
                  type: "text",
                  text: [
                    tc.steps?.length ? "Steps: " + tc.steps.join("; ") : "",
                    tc.expectedResult ? "Expected: " + tc.expectedResult : "",
                  ]
                    .filter(Boolean)
                    .join("\n"),
                },
              ],
            },
          ],
        },
      },
    };

    const res = await fetch(`${base}/issue`, {
      method: "POST",
      headers: {
        Authorization: auth,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      // Fallback: add as comment
      await addTestCasesComment(base, auth, storyKey, testCases);
      return;
    }
  }
}

async function addTestCasesComment(
  base: string,
  auth: string,
  storyKey: string,
  testCases: Array<{ title: string; steps?: string[]; expectedResult?: string | null }>,
) {
  const lines = testCases
    .map((tc) => `- ${tc.title}`)
    .join("\n");

  await fetch(`${base}/issue/${storyKey}/comment`, {
    method: "POST",
    headers: {
      Authorization: auth,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      body: {
        type: "doc",
        version: 1,
        content: [
          {
            type: "paragraph",
            content: [{ type: "text", text: "Generated test cases:\n" + lines }],
          },
        ],
      },
    }),
  });
}

export interface JiraBugReport {
  title: string;
  summary: string;
  storyKey?: string;
}

/**
 * Creates a Bug issue in Jira. Returns the created issue key.
 */
export async function createJiraBugReport(
  config: JiraConfig,
  token: string,
  bugReport: JiraBugReport,
): Promise<string> {
  const auth = basicAuth(config.email, token);
  const base = baseUrl(config.domain);

  const body = {
    fields: {
      project: { key: config.projectKey },
      summary: bugReport.title,
      issuetype: { name: "Bug" },
      description: {
        type: "doc",
        version: 1,
        content: [
          {
            type: "paragraph",
            content: [{ type: "text", text: bugReport.summary }],
          },
        ],
      },
      ...(bugReport.storyKey
        ? { parent: { key: bugReport.storyKey } }
        : {}),
    },
  };

  const res = await fetch(`${base}/issue`, {
    method: "POST",
    headers: {
      Authorization: auth,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Jira createBug error ${res.status}: ${text}`);
  }

  const data = (await res.json()) as { key: string };
  return data.key;
}
