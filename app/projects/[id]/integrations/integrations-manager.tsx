"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge, type BadgeProps } from "@/components/ui/badge";

export interface IntegrationView {
  id: string;
  type: string;
  name: string;
  config: Record<string, unknown>;
  enabled: boolean;
  hasSecret: boolean;
  lastTriggeredAt: string | null;
  lastStatus: string | null;
  lastError: string | null;
  createdAt: string;
}

export interface JiraStory {
  id: string;
  key: string;
  summary: string;
  description: string | null;
  status: string;
  issueType: string;
}

const TYPES = [
  { value: "slack", label: "Slack" },
  { value: "github", label: "GitHub" },
  { value: "webhook", label: "Generic webhook" },
  { value: "jira", label: "Jira" },
] as const;

type IntegrationType = (typeof TYPES)[number]["value"];

function typeLabel(type: string): string {
  return TYPES.find((t) => t.value === type)?.label ?? type;
}

function statusVariant(
  status: string | null,
  enabled: boolean,
): BadgeProps["variant"] {
  if (!enabled) return "secondary";
  if (status === "success") return "low";
  if (status === "error") return "high";
  return "secondary";
}

function statusLabel(status: string | null, enabled: boolean): string {
  if (!enabled) return "Disabled";
  if (status === "success") return "Last run: success";
  if (status === "error") return "Last run: error";
  return "Never triggered";
}

function configSummary(type: string, config: Record<string, unknown>): string {
  if (type === "slack") {
    const channel = typeof config.channel === "string" ? config.channel : null;
    return channel ? `Channel: ${channel}` : "Incoming webhook configured";
  }
  if (type === "github") {
    const repo = typeof config.repo === "string" ? config.repo : null;
    return repo ? `Repo: ${repo}` : "No repo configured";
  }
  if (type === "jira") {
    const domain = typeof config.domain === "string" ? config.domain : null;
    const projectKey = typeof config.projectKey === "string" ? config.projectKey : null;
    if (domain && projectKey) return `${domain}.atlassian.net / ${projectKey}`;
    return "Jira workspace configured";
  }
  const url = typeof config.url === "string" ? config.url : null;
  return url ?? "No URL configured";
}

export function IntegrationsManager({
  projectId,
  initialIntegrations,
}: {
  projectId: string;
  initialIntegrations: IntegrationView[];
}) {
  const [integrations, setIntegrations] =
    useState<IntegrationView[]>(initialIntegrations);
  const [showForm, setShowForm] = useState(false);
  const [type, setType] = useState<IntegrationType>("slack");
  const [name, setName] = useState("");
  const [channel, setChannel] = useState("");
  const [repo, setRepo] = useState("");
  const [url, setUrl] = useState("");
  const [secret, setSecret] = useState("");
  // Jira-specific
  const [jiraDomain, setJiraDomain] = useState("");
  const [jiraProjectKey, setJiraProjectKey] = useState("");
  const [jiraEmail, setJiraEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [actionState, setActionState] = useState<
    Record<string, { busy: boolean; message: string | null }>
  >({});
  // Jira stories
  const [jiraStories, setJiraStories] = useState<JiraStory[] | null>(null);
  const [fetchingStories, setFetchingStories] = useState<Record<string, boolean>>({});

  const resetForm = () => {
    setName("");
    setChannel("");
    setRepo("");
    setUrl("");
    setSecret("");
    setJiraDomain("");
    setJiraProjectKey("");
    setJiraEmail("");
    setFormError(null);
  };

  const buildConfig = (): Record<string, unknown> => {
    if (type === "slack") return channel ? { channel } : {};
    if (type === "github") return repo ? { repo } : {};
    if (type === "jira")
      return { domain: jiraDomain.trim(), projectKey: jiraProjectKey.trim(), email: jiraEmail.trim() };
    return url ? { url } : {};
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!name.trim()) {
      setFormError("Name is required");
      return;
    }
    if (type === "slack" && !secret.trim()) {
      setFormError("A Slack incoming-webhook URL is required");
      return;
    }
    if (type === "github" && (!repo.trim() || !secret.trim())) {
      setFormError("A repo (owner/repo) and personal access token are required");
      return;
    }
    if (type === "webhook" && !url.trim()) {
      setFormError("A URL is required");
      return;
    }
    if (type === "jira" && (!jiraDomain.trim() || !jiraProjectKey.trim() || !jiraEmail.trim() || !secret.trim())) {
      setFormError("Domain, project key, email, and API token are all required for Jira");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/integrations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type,
          name: name.trim(),
          config: buildConfig(),
          secret: secret.trim() || undefined,
        }),
      });
      const data = (await res.json()) as IntegrationView & { error?: string };
      if (!res.ok) {
        setFormError(data.error ?? "Failed to create integration");
        return;
      }
      setIntegrations((prev) => [data, ...prev]);
      setShowForm(false);
      resetForm();
    } catch (err) {
      setFormError(
        err instanceof Error ? err.message : "Failed to create integration",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const setBusy = (id: string, busy: boolean, message: string | null = null) => {
    setActionState((prev) => ({ ...prev, [id]: { busy, message } }));
  };

  const handleToggle = async (integration: IntegrationView) => {
    setBusy(integration.id, true);
    try {
      const res = await fetch(
        `/api/projects/${projectId}/integrations/${integration.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ enabled: !integration.enabled }),
        },
      );
      const data = (await res.json()) as IntegrationView & { error?: string };
      if (res.ok) {
        setIntegrations((prev) =>
          prev.map((i) => (i.id === integration.id ? data : i)),
        );
      }
    } finally {
      setBusy(integration.id, false);
    }
  };

  const handleDelete = async (integration: IntegrationView) => {
    setBusy(integration.id, true);
    try {
      const res = await fetch(
        `/api/projects/${projectId}/integrations/${integration.id}`,
        { method: "DELETE" },
      );
      if (res.ok) {
        setIntegrations((prev) => prev.filter((i) => i.id !== integration.id));
      }
    } finally {
      setBusy(integration.id, false);
    }
  };

  const handleTest = async (integration: IntegrationView) => {
    setBusy(integration.id, true, null);
    try {
      const res = await fetch(
        `/api/projects/${projectId}/integrations/${integration.id}/test`,
        { method: "POST" },
      );
      const data = (await res.json()) as { status?: string; error?: string };
      const message =
        data.status === "success"
          ? "Test sent successfully"
          : `Test failed: ${data.error ?? "unknown error"}`;
      setBusy(integration.id, false, message);
      setIntegrations((prev) =>
        prev.map((i) =>
          i.id === integration.id
            ? {
                ...i,
                lastStatus: data.status === "success" ? "success" : "error",
                lastTriggeredAt: new Date().toISOString(),
                lastError: data.status === "success" ? null : (data.error ?? "Unknown error"),
              }
            : i,
        ),
      );
    } catch (err) {
      setBusy(
        integration.id,
        false,
        `Test failed: ${err instanceof Error ? err.message : "unknown error"}`,
      );
    }
  };

  const handleFetchStories = async (integration: IntegrationView) => {
    setFetchingStories((prev) => ({ ...prev, [integration.id]: true }));
    setJiraStories(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/jira/stories`);
      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        setBusy(integration.id, false, `Failed: ${data.error ?? "unknown"}`);
        return;
      }
      const stories = (await res.json()) as JiraStory[];
      setJiraStories(stories);
    } catch (err) {
      setBusy(
        integration.id,
        false,
        `Failed: ${err instanceof Error ? err.message : "unknown"}`,
      );
    } finally {
      setFetchingStories((prev) => ({ ...prev, [integration.id]: false }));
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-sm text-neutral-500">
          {integrations.length} connected integration
          {integrations.length === 1 ? "" : "s"}
        </p>
        <Button
          type="button"
          variant={showForm ? "outline" : "default"}
          onClick={() => {
            setShowForm((s) => !s);
            if (showForm) resetForm();
          }}
        >
          {showForm ? "Cancel" : "Add integration"}
        </Button>
      </div>

      {showForm ? (
        <form
          onSubmit={handleCreate}
          className="space-y-4 rounded-md border border-neutral-200 p-4"
        >
          <div className="space-y-1.5">
            <Label htmlFor="integration-type">Type</Label>
            <select
              id="integration-type"
              value={type}
              onChange={(e) => setType(e.target.value as IntegrationType)}
              className="h-9 w-full rounded-md border border-neutral-300 bg-white px-3 text-sm"
            >
              {TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="integration-name">Name</Label>
            <Input
              id="integration-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. #qa-alerts"
              required
            />
          </div>

          {type === "slack" ? (
            <>
              <div className="space-y-1.5">
                <Label htmlFor="slack-webhook">Incoming webhook URL</Label>
                <Input
                  id="slack-webhook"
                  type="url"
                  value={secret}
                  onChange={(e) => setSecret(e.target.value)}
                  placeholder="https://hooks.slack.com/services/…"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="slack-channel">Channel label (optional)</Label>
                <Input
                  id="slack-channel"
                  value={channel}
                  onChange={(e) => setChannel(e.target.value)}
                  placeholder="#qa"
                />
              </div>
            </>
          ) : null}

          {type === "github" ? (
            <>
              <div className="space-y-1.5">
                <Label htmlFor="github-repo">Repository (owner/repo)</Label>
                <Input
                  id="github-repo"
                  value={repo}
                  onChange={(e) => setRepo(e.target.value)}
                  placeholder="my-org/my-repo"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="github-token">Personal access token</Label>
                <Input
                  id="github-token"
                  type="password"
                  value={secret}
                  onChange={(e) => setSecret(e.target.value)}
                  placeholder="ghp_…"
                  required
                />
              </div>
            </>
          ) : null}

          {type === "webhook" ? (
            <>
              <div className="space-y-1.5">
                <Label htmlFor="webhook-url">URL</Label>
                <Input
                  id="webhook-url"
                  type="url"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://example.com/hooks/qa-copilot"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="webhook-secret">
                  Signing secret (optional)
                </Label>
                <Input
                  id="webhook-secret"
                  type="password"
                  value={secret}
                  onChange={(e) => setSecret(e.target.value)}
                  placeholder="Used to compute X-QA-Copilot-Signature"
                />
              </div>
            </>
          ) : null}

          {type === "jira" ? (
            <>
              <div className="space-y-1.5">
                <Label htmlFor="jira-domain">Jira domain (subdomain only)</Label>
                <Input
                  id="jira-domain"
                  value={jiraDomain}
                  onChange={(e) => setJiraDomain(e.target.value)}
                  placeholder="mycompany"
                  required
                />
                <p className="text-xs text-neutral-500">
                  e.g. for mycompany.atlassian.net enter &quot;mycompany&quot;
                </p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="jira-project-key">Project key</Label>
                <Input
                  id="jira-project-key"
                  value={jiraProjectKey}
                  onChange={(e) => setJiraProjectKey(e.target.value)}
                  placeholder="PROJ"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="jira-email">Jira account email</Label>
                <Input
                  id="jira-email"
                  type="email"
                  value={jiraEmail}
                  onChange={(e) => setJiraEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="jira-token">API token</Label>
                <Input
                  id="jira-token"
                  type="password"
                  value={secret}
                  onChange={(e) => setSecret(e.target.value)}
                  placeholder="Jira API token (from id.atlassian.com)"
                  required
                />
              </div>
            </>
          ) : null}

          {formError ? (
            <p className="text-sm text-red-600">{formError}</p>
          ) : null}

          <Button type="submit" disabled={submitting}>
            {submitting ? "Creating…" : "Create integration"}
          </Button>
        </form>
      ) : null}

      {integrations.length === 0 ? (
        <p className="py-6 text-center text-neutral-500">
          No integrations connected yet.
        </p>
      ) : (
        <ul className="space-y-3">
          {integrations.map((integration) => {
            const state = actionState[integration.id];
            const isFetching = fetchingStories[integration.id];
            return (
              <li
                key={integration.id}
                className="space-y-3 rounded-md border border-neutral-200 p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{integration.name}</span>
                      <Badge variant="secondary">
                        {typeLabel(integration.type)}
                      </Badge>
                      <Badge
                        variant={statusVariant(
                          integration.lastStatus,
                          integration.enabled,
                        )}
                      >
                        {statusLabel(integration.lastStatus, integration.enabled)}
                      </Badge>
                      {integration.hasSecret ? (
                        <Badge variant="outline">Secret stored</Badge>
                      ) : null}
                    </div>
                    <p className="mt-1 text-sm text-neutral-500">
                      {configSummary(integration.type, integration.config)}
                    </p>
                    {integration.lastError ? (
                      <p className="mt-1 text-xs text-red-600">
                        {integration.lastError}
                      </p>
                    ) : null}
                    {integration.lastTriggeredAt ? (
                      <p className="mt-1 text-xs text-neutral-400">
                        Last triggered{" "}
                        {new Date(integration.lastTriggeredAt).toLocaleString()}
                      </p>
                    ) : null}
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {integration.type !== "jira" ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={state?.busy}
                        onClick={() => handleTest(integration)}
                      >
                        Send test
                      </Button>
                    ) : (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={isFetching}
                        onClick={() => handleFetchStories(integration)}
                      >
                        {isFetching ? "Fetching…" : "Fetch Stories"}
                      </Button>
                    )}
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={state?.busy}
                      onClick={() => handleToggle(integration)}
                    >
                      {integration.enabled ? "Disable" : "Enable"}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="destructive"
                      disabled={state?.busy}
                      onClick={() => handleDelete(integration)}
                    >
                      Delete
                    </Button>
                  </div>
                </div>
                {state?.message ? (
                  <p
                    className={
                      state.message.startsWith("Test sent")
                        ? "text-sm text-green-700"
                        : "text-sm text-red-600"
                    }
                  >
                    {state.message}
                  </p>
                ) : null}

                {/* Jira stories list */}
                {integration.type === "jira" && jiraStories !== null ? (
                  <div className="mt-2 space-y-1 rounded-md bg-neutral-50 p-3">
                    <p className="text-xs font-medium text-neutral-600">
                      Imported stories ({jiraStories.length})
                    </p>
                    {jiraStories.length === 0 ? (
                      <p className="text-xs text-neutral-500">No stories found.</p>
                    ) : (
                      <ul className="space-y-1">
                        {jiraStories.map((s) => (
                          <li key={s.id} className="text-xs">
                            <span className="font-mono text-neutral-500">{s.key}</span>{" "}
                            <span>{s.summary}</span>{" "}
                            <Badge variant="secondary" className="text-[10px]">
                              {s.status}
                            </Badge>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
