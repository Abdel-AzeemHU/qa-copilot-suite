"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export interface CiTokenView {
  id: string;
  name: string;
  tokenPrefix: string;
  lastUsedAt: string | null;
  expiresAt: string | null;
  revokedAt: string | null;
  createdAt: string;
}

export interface CiRunView {
  id: string;
  status: string;
  summary: string | null;
  ref: string | null;
  commit: string | null;
  prNumber: number | null;
  createdAt: string;
}

function statusVariant(status: string): BadgeProps["variant"] {
  if (status === "succeeded") return "low";
  if (status === "failed" || status === "error") return "high";
  return "secondary";
}

function fmt(d: string | null): string {
  if (!d) return "—";
  return new Date(d).toLocaleString();
}

function CopyBlock({ text, label }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="relative">
      <pre className="overflow-x-auto rounded-md border border-neutral-800 bg-neutral-950 p-3 text-xs text-neutral-200">
        <code>{text}</code>
      </pre>
      <button
        type="button"
        onClick={() => {
          void navigator.clipboard.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        }}
        className="absolute right-2 top-2 rounded bg-neutral-800 px-2 py-1 text-xs text-neutral-200 hover:bg-neutral-700"
      >
        {copied ? "Copied" : label ?? "Copy"}
      </button>
    </div>
  );
}

export function CiSetup({
  projectId,
  appUrl,
  initialTokens,
  recentRuns,
}: {
  projectId: string;
  appUrl: string;
  initialTokens: CiTokenView[];
  recentRuns: CiRunView[];
}) {
  const [tokens, setTokens] = useState<CiTokenView[]>(initialTokens);
  const [name, setName] = useState("");
  const [expiresInDays, setExpiresInDays] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [newToken, setNewToken] = useState<string | null>(null);
  const [busyMap, setBusyMap] = useState<Record<string, boolean>>({});

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (!name.trim()) {
      setFormError("Token name is required");
      return;
    }
    setSubmitting(true);
    try {
      const body: { name: string; expiresInDays?: number } = {
        name: name.trim(),
      };
      const days = parseInt(expiresInDays, 10);
      if (!Number.isNaN(days) && days > 0) body.expiresInDays = days;

      const res = await fetch(`/api/projects/${projectId}/ci-tokens`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await res.json()) as {
        id?: string;
        name?: string;
        token?: string;
        error?: string;
      };
      if (!res.ok || !data.token || !data.id) {
        setFormError(data.error ?? "Failed to create token");
        return;
      }
      setNewToken(data.token);
      setTokens((prev) => [
        {
          id: data.id!,
          name: data.name ?? name.trim(),
          tokenPrefix: data.token!.slice(0, 8),
          lastUsedAt: null,
          expiresAt: null,
          revokedAt: null,
          createdAt: new Date().toISOString(),
        },
        ...prev,
      ]);
      setName("");
      setExpiresInDays("");
    } catch {
      setFormError("Network error");
    } finally {
      setSubmitting(false);
    }
  };

  const handleRevoke = async (tokenId: string) => {
    setBusyMap((m) => ({ ...m, [tokenId]: true }));
    try {
      const res = await fetch(
        `/api/projects/${projectId}/ci-tokens/${tokenId}`,
        { method: "DELETE" },
      );
      if (res.ok) {
        setTokens((prev) =>
          prev.map((t) =>
            t.id === tokenId
              ? { ...t, revokedAt: new Date().toISOString() }
              : t,
          ),
        );
      }
    } finally {
      setBusyMap((m) => ({ ...m, [tokenId]: false }));
    }
  };

  const yamlSnippet = `name: QA Copilot on PR
on: pull_request
jobs:
  qa:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: ./.github/actions/qa-copilot-run
        with:
          api-token: \${{ secrets.QACS_TOKEN }}
          api-base-url: ${appUrl}
          target-url: https://staging.example.com
          visual: "true"`;

  const curlSnippet = `curl -X POST "${appUrl}/api/ci/trigger" \\
  -H "Authorization: Bearer $QACS_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{"targetUrl":"https://staging.example.com","visual":true}'`;

  return (
    <div className="space-y-6">
      {/* New token reveal */}
      {newToken ? (
        <Card className="border-amber-600/60">
          <CardHeader>
            <CardTitle className="text-amber-400">
              Copy your token now — you won&apos;t see it again
            </CardTitle>
            <CardDescription>
              This is the only time the raw token is shown. Store it as a GitHub
              secret named <code>QACS_TOKEN</code>.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <CopyBlock text={newToken} label="Copy token" />
            <Button variant="outline" onClick={() => setNewToken(null)}>
              I&apos;ve saved it
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {/* Tokens */}
      <Card>
        <CardHeader>
          <CardTitle>CI tokens</CardTitle>
          <CardDescription>
            Project-scoped API tokens used to trigger the pipeline from CI.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <form
            onSubmit={handleCreate}
            className="flex flex-wrap items-end gap-3"
          >
            <div className="flex-1 min-w-[200px]">
              <Label htmlFor="token-name">Name</Label>
              <Input
                id="token-name"
                placeholder="GitHub Actions CI"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div className="w-40">
              <Label htmlFor="token-expiry">Expires (days, optional)</Label>
              <Input
                id="token-expiry"
                type="number"
                min="1"
                placeholder="never"
                value={expiresInDays}
                onChange={(e) => setExpiresInDays(e.target.value)}
              />
            </div>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Generating…" : "Generate token"}
            </Button>
          </form>
          {formError ? (
            <p className="text-sm text-red-400">{formError}</p>
          ) : null}

          {tokens.length === 0 ? (
            <p className="py-4 text-center text-neutral-500">
              No tokens yet. Generate one to wire up CI.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Prefix</TableHead>
                  <TableHead>Last used</TableHead>
                  <TableHead>Expires</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tokens.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell className="font-medium">{t.name}</TableCell>
                    <TableCell>
                      <code className="text-xs">{t.tokenPrefix}…</code>
                    </TableCell>
                    <TableCell>{fmt(t.lastUsedAt)}</TableCell>
                    <TableCell>{fmt(t.expiresAt)}</TableCell>
                    <TableCell>
                      {t.revokedAt ? (
                        <Badge variant="high">revoked</Badge>
                      ) : (
                        <Badge variant="low">active</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {!t.revokedAt ? (
                        <button
                          type="button"
                          disabled={busyMap[t.id]}
                          onClick={() => handleRevoke(t.id)}
                          className="text-sm text-red-400 underline disabled:opacity-50"
                        >
                          Revoke
                        </button>
                      ) : null}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Setup instructions */}
      <Card>
        <CardHeader>
          <CardTitle>Setup instructions</CardTitle>
          <CardDescription>
            Wire QA Copilot Suite into your pipeline in a few minutes.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5 text-sm">
          <div>
            <h3 className="mb-2 font-medium">
              1. Add the token as a GitHub secret
            </h3>
            <p className="text-neutral-400">
              In your repo: Settings → Secrets and variables → Actions → New
              repository secret. Name it <code>QACS_TOKEN</code> and paste the
              token shown above.
            </p>
          </div>
          <div>
            <h3 className="mb-2 font-medium">
              2. Add the workflow (GitHub Actions)
            </h3>
            <p className="mb-2 text-neutral-400">
              Drop this into <code>.github/workflows/qa.yml</code>. It uses the
              composite action shipped in this repo at{" "}
              <code>.github/actions/qa-copilot-run</code>. Marketplace-style
              usage is also supported once published, e.g.{" "}
              <code>uses: your-org/qa-copilot-action@v1</code>.
            </p>
            <CopyBlock text={yamlSnippet} />
          </div>
          <div>
            <h3 className="mb-2 font-medium">3. Any other CI (raw curl)</h3>
            <p className="mb-2 text-neutral-400">
              The trigger endpoint works from any CI system. Poll{" "}
              <code>{appUrl}/api/ci/runs/&lt;id&gt;</code> until{" "}
              <code>status</code> is terminal, then branch on{" "}
              <code>conclusion</code>.
            </p>
            <CopyBlock text={curlSnippet} />
          </div>
        </CardContent>
      </Card>

      {/* Recent CI runs */}
      <Card>
        <CardHeader>
          <CardTitle>Recent CI runs</CardTitle>
          <CardDescription>
            Pipeline runs triggered from CI (GitHub Actions).
          </CardDescription>
        </CardHeader>
        <CardContent>
          {recentRuns.length === 0 ? (
            <p className="py-4 text-center text-neutral-500">
              No CI-triggered runs yet.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>When</TableHead>
                  <TableHead>Ref</TableHead>
                  <TableHead>Commit</TableHead>
                  <TableHead>PR</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Summary</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentRuns.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell>{fmt(r.createdAt)}</TableCell>
                    <TableCell className="font-mono text-xs">
                      {r.ref ?? "—"}
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {r.commit ? r.commit.slice(0, 8) : "—"}
                    </TableCell>
                    <TableCell>{r.prNumber ?? "—"}</TableCell>
                    <TableCell>
                      <Badge variant={statusVariant(r.status)}>
                        {r.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="max-w-xs truncate text-neutral-400">
                      {r.summary ?? "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
