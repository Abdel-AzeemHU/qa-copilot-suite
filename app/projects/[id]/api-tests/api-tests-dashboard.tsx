"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button, buttonVariants } from "@/components/ui/button";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// --- Types ---

interface ApiSpecSummary {
  id: string;
  name: string;
  sourceType: string;
  baseUrl: string | null;
  createdAt: string;
  _count: { endpoints: number };
}

interface ApiEndpoint {
  id: string;
  method: string;
  path: string;
  operationId: string | null;
  summary: string | null;
  description: string | null;
  tags: string;
  _count: { testCases: number };
}

interface ApiSpecDetail extends ApiSpecSummary {
  endpoints: ApiEndpoint[];
}

interface GeneratedTestCase {
  id: string;
  title: string;
  type: string;
  priority: string;
}

// --- Helpers ---

function methodVariant(method: string): BadgeProps["variant"] {
  switch (method.toUpperCase()) {
    case "GET":
      return "info";
    case "POST":
      return "low";
    case "PUT":
    case "PATCH":
      return "medium";
    case "DELETE":
      return "high";
    default:
      return "secondary";
  }
}

function priorityVariant(priority: string): BadgeProps["variant"] {
  if (priority === "high") return "high";
  if (priority === "low") return "low";
  return "medium";
}

// --- Main component ---

export function ApiTestsDashboard({ projectId }: { projectId: string }) {
  const [specs, setSpecs] = useState<ApiSpecSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"specs" | "import">("specs");

  // Import form state
  const [name, setName] = useState("");
  const [content, setContent] = useState("");
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);

  // Selected spec detail
  const [activeSpec, setActiveSpec] = useState<ApiSpecDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [countPerEndpoint, setCountPerEndpoint] = useState(3);
  const [generating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [generated, setGenerated] = useState<GeneratedTestCase[] | null>(null);

  const loadSpecs = useCallback(async () => {
    const res = await fetch(`/api/projects/${projectId}/api-specs`);
    if (res.ok) {
      const data = (await res.json()) as { specs: ApiSpecSummary[] };
      setSpecs(data.specs);
    }
    setLoading(false);
  }, [projectId]);

  useEffect(() => {
    void loadSpecs();
  }, [loadSpecs]);

  const handleImport = async () => {
    if (!name || !content) return;
    setImporting(true);
    setImportError(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/api-specs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, content }),
      });
      const data = (await res.json()) as { spec?: ApiSpecSummary; error?: string };
      if (!res.ok) {
        setImportError(data.error ?? "Failed to import spec");
        return;
      }
      setSpecs((prev) => [data.spec!, ...prev]);
      setName("");
      setContent("");
      setTab("specs");
      void openSpec(data.spec!.id);
    } finally {
      setImporting(false);
    }
  };

  const openSpec = async (specId: string) => {
    setLoadingDetail(true);
    setGenerated(null);
    setGenerateError(null);
    setSelected(new Set());
    try {
      const res = await fetch(`/api/projects/${projectId}/api-specs/${specId}`);
      if (res.ok) {
        const data = (await res.json()) as { spec: ApiSpecDetail };
        setActiveSpec(data.spec);
      }
    } finally {
      setLoadingDetail(false);
    }
  };

  const handleDelete = async (specId: string) => {
    const res = await fetch(`/api/projects/${projectId}/api-specs/${specId}`, {
      method: "DELETE",
    });
    if (res.ok) {
      setSpecs((prev) => prev.filter((s) => s.id !== specId));
      if (activeSpec?.id === specId) setActiveSpec(null);
    }
  };

  const toggleEndpoint = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (!activeSpec) return;
    if (selected.size === activeSpec.endpoints.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(activeSpec.endpoints.map((e) => e.id)));
    }
  };

  const handleGenerate = async () => {
    if (!activeSpec || selected.size === 0) return;
    setGenerating(true);
    setGenerateError(null);
    setGenerated(null);
    try {
      const res = await fetch(
        `/api/projects/${projectId}/api-specs/${activeSpec.id}/generate`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            endpointIds: Array.from(selected),
            countPerEndpoint,
          }),
        },
      );
      const data = (await res.json()) as {
        testCases?: GeneratedTestCase[];
        error?: string;
      };
      if (!res.ok) {
        setGenerateError(data.error ?? "Failed to generate test cases");
        return;
      }
      setGenerated(data.testCases ?? []);
      void openSpec(activeSpec.id);
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Tabs */}
      <div className="flex gap-2 border-b border-neutral-200">
        {(["specs", "import"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`pb-2 text-sm font-medium capitalize transition-colors ${
              tab === t
                ? "border-b-2 border-neutral-900 text-neutral-900"
                : "text-neutral-500 hover:text-neutral-700"
            }`}
          >
            {t === "specs" ? "Imported specs" : "Import spec"}
          </button>
        ))}
      </div>

      {tab === "import" ? (
        <Card>
          <CardHeader>
            <CardTitle>Import API spec</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="spec-name">Name</Label>
              <Input
                id="spec-name"
                placeholder="e.g. Petstore API v1"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="spec-content">
                OpenAPI/Swagger (JSON or YAML) or Postman Collection (JSON)
              </Label>
              <textarea
                id="spec-content"
                className="h-64 w-full rounded-md border border-input bg-background px-3 py-2 font-mono text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                placeholder="Paste the spec content here…"
                value={content}
                onChange={(e) => setContent(e.target.value)}
              />
              <p className="text-xs text-neutral-500">
                The spec type (OpenAPI vs. Postman) is detected automatically.
              </p>
            </div>
            {importError && (
              <p className="rounded-md bg-red-50 p-3 text-sm text-red-600">
                {importError}
              </p>
            )}
            <Button onClick={handleImport} disabled={importing || !name || !content}>
              {importing ? "Importing…" : "Import & parse"}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
          {/* Spec list */}
          <div className="space-y-2">
            {loading ? (
              <p className="text-sm text-neutral-500">Loading…</p>
            ) : specs.length === 0 ? (
              <div className="rounded-lg border border-dashed border-neutral-200 p-6 text-center">
                <p className="text-sm font-medium text-neutral-700">
                  No specs imported yet
                </p>
                <Button
                  className="mt-3"
                  variant="outline"
                  size="sm"
                  onClick={() => setTab("import")}
                >
                  Import a spec
                </Button>
              </div>
            ) : (
              specs.map((spec) => (
                <button
                  key={spec.id}
                  onClick={() => void openSpec(spec.id)}
                  className={`block w-full rounded-md border p-3 text-left text-sm transition-colors ${
                    activeSpec?.id === spec.id
                      ? "border-neutral-900 bg-neutral-50"
                      : "border-neutral-200 hover:bg-neutral-50"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate font-medium">{spec.name}</span>
                    <Badge variant="secondary">{spec.sourceType}</Badge>
                  </div>
                  <p className="mt-1 text-xs text-neutral-500">
                    {spec._count.endpoints} endpoint
                    {spec._count.endpoints !== 1 ? "s" : ""}
                  </p>
                </button>
              ))
            )}
          </div>

          {/* Spec detail */}
          <div>
            {loadingDetail ? (
              <p className="text-sm text-neutral-500">Loading endpoints…</p>
            ) : !activeSpec ? (
              <div className="flex h-full items-center justify-center rounded-lg border border-dashed border-neutral-200 p-12 text-center text-sm text-neutral-500">
                Select a spec to view its endpoints
              </div>
            ) : (
              <Card>
                <CardHeader>
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <CardTitle>{activeSpec.name}</CardTitle>
                      {activeSpec.baseUrl && (
                        <p className="mt-1 text-xs text-neutral-500">
                          {activeSpec.baseUrl}
                        </p>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => void handleDelete(activeSpec.id)}
                    >
                      Delete spec
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-3 rounded-md bg-neutral-50 p-3">
                    <button
                      className="text-xs text-blue-600 hover:underline"
                      onClick={toggleAll}
                    >
                      {selected.size === activeSpec.endpoints.length
                        ? "Deselect all"
                        : "Select all"}
                    </button>
                    <div className="flex items-center gap-2">
                      <Label htmlFor="count-per" className="text-xs">
                        Test cases per endpoint
                      </Label>
                      <Input
                        id="count-per"
                        type="number"
                        min={1}
                        max={6}
                        value={countPerEndpoint}
                        onChange={(e) => setCountPerEndpoint(Number(e.target.value))}
                        className="h-8 w-16"
                      />
                    </div>
                    <Button
                      size="sm"
                      onClick={handleGenerate}
                      disabled={generating || selected.size === 0}
                    >
                      {generating
                        ? "Generating…"
                        : `Generate test cases (${selected.size})`}
                    </Button>
                  </div>

                  {generateError && (
                    <p className="rounded-md bg-red-50 p-3 text-sm text-red-600">
                      {generateError}
                    </p>
                  )}

                  {generated && (
                    <div className="rounded-md bg-green-50 p-3 text-sm">
                      <p className="mb-2 font-medium text-green-800">
                        Generated {generated.length} test case
                        {generated.length !== 1 ? "s" : ""}
                      </p>
                      <ul className="space-y-1">
                        {generated.map((tc) => (
                          <li key={tc.id} className="flex items-center gap-2">
                            <Badge variant={priorityVariant(tc.priority)}>
                              {tc.priority}
                            </Badge>
                            <span className="text-neutral-700">{tc.title}</span>
                          </li>
                        ))}
                      </ul>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <Link
                          href={`/projects/${projectId}`}
                          className={buttonVariants({ size: "sm", variant: "outline" })}
                        >
                          View test cases
                        </Link>
                        <Link
                          href={`/projects/${projectId}/automation`}
                          className={buttonVariants({ size: "sm", variant: "outline" })}
                        >
                          Generate automation code
                        </Link>
                      </div>
                    </div>
                  )}

                  <div className="space-y-1">
                    {activeSpec.endpoints.map((ep) => (
                      <label
                        key={ep.id}
                        className="flex cursor-pointer items-start gap-3 rounded-md border border-neutral-100 p-2 text-sm hover:bg-neutral-50"
                      >
                        <input
                          type="checkbox"
                          className="mt-1"
                          checked={selected.has(ep.id)}
                          onChange={() => toggleEndpoint(ep.id)}
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge variant={methodVariant(ep.method)}>
                              {ep.method}
                            </Badge>
                            <span className="truncate font-mono text-xs">
                              {ep.path}
                            </span>
                            {ep._count.testCases > 0 && (
                              <Badge variant="secondary">
                                {ep._count.testCases} test
                                {ep._count.testCases !== 1 ? "s" : ""}
                              </Badge>
                            )}
                          </div>
                          {ep.summary && (
                            <p className="mt-0.5 text-xs text-neutral-500">
                              {ep.summary}
                            </p>
                          )}
                        </div>
                      </label>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
