"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

type ProviderInfo = {
  provider: "claude" | "openai";
  hasKey: boolean;
  model: string | null;
};

type ProviderState = {
  activeProvider: string;
  providers: ProviderInfo[];
};

const PROVIDER_LABELS: Record<string, { name: string; defaultModel: string }> =
  {
    claude: { name: "Claude (Anthropic)", defaultModel: "claude-opus-4-8" },
    openai: { name: "OpenAI", defaultModel: "gpt-4o" },
  };

export function ProviderSettings() {
  const [state, setState] = useState<ProviderState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Per-provider form state
  const [apiKeyInputs, setApiKeyInputs] = useState<
    Record<string, { key: string; model: string }>
  >({ claude: { key: "", model: "" }, openai: { key: "", model: "" } });
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [removing, setRemoving] = useState<Record<string, boolean>>({});
  const [switching, setSwitching] = useState(false);

  const loadState = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/user/provider");
      if (!res.ok) throw new Error("Failed to load provider settings");
      const data = (await res.json()) as ProviderState;
      setState(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadState();
  }, [loadState]);

  const handleSaveKey = async (provider: "claude" | "openai") => {
    const { key, model } = apiKeyInputs[provider] ?? { key: "", model: "" };
    if (!key.trim()) return;
    setSaving((s) => ({ ...s, [provider]: true }));
    setError(null);
    try {
      const res = await fetch("/api/user/provider", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider,
          apiKey: key.trim(),
          model: model.trim() || undefined,
        }),
      });
      if (!res.ok) {
        const d = (await res.json()) as { error?: string };
        throw new Error(d.error ?? "Save failed");
      }
      setApiKeyInputs((prev) => ({ ...prev, [provider]: { key: "", model: "" } }));
      await loadState();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving((s) => ({ ...s, [provider]: false }));
    }
  };

  const handleRemove = async (provider: "claude" | "openai") => {
    setRemoving((r) => ({ ...r, [provider]: true }));
    setError(null);
    try {
      const res = await fetch("/api/user/provider", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider }),
      });
      if (!res.ok) {
        const d = (await res.json()) as { error?: string };
        throw new Error(d.error ?? "Remove failed");
      }
      await loadState();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Remove failed");
    } finally {
      setRemoving((r) => ({ ...r, [provider]: false }));
    }
  };

  const handleSwitch = async (provider: "claude" | "openai") => {
    setSwitching(true);
    setError(null);
    // Optimistic update
    setState((prev) =>
      prev ? { ...prev, activeProvider: provider } : prev,
    );
    try {
      const res = await fetch("/api/user/provider", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ activeProvider: provider }),
      });
      if (!res.ok) {
        const d = (await res.json()) as { error?: string };
        throw new Error(d.error ?? "Switch failed");
      }
      await loadState();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Switch failed");
      await loadState(); // revert optimistic
    } finally {
      setSwitching(false);
    }
  };

  if (loading) {
    return (
      <div className="text-sm text-neutral-500">Loading provider settings…</div>
    );
  }

  if (!state) {
    return (
      <div className="text-sm text-red-500">
        {error ?? "Failed to load settings"}
      </div>
    );
  }

  const bothConnected = state.providers.every((p) => p.hasKey);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>AI Provider</CardTitle>
          <CardDescription>
            Configure which AI provider powers all helpers and chat.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {error && (
            <div className="rounded-md bg-red-50 px-4 py-2 text-sm text-red-700">
              {error}
            </div>
          )}

          {/* Active provider display */}
          <div className="flex items-center gap-3">
            <span className="text-sm text-neutral-600">Active provider:</span>
            <Badge variant="default">
              {PROVIDER_LABELS[state.activeProvider]?.name ?? state.activeProvider}
            </Badge>
            <span className="text-xs text-neutral-400">
              ({PROVIDER_LABELS[state.activeProvider]?.defaultModel ?? ""})
            </span>
          </div>

          {/* Per-provider cards */}
          {state.providers.map((p) => {
            const label = PROVIDER_LABELS[p.provider] ?? {
              name: p.provider,
              defaultModel: "",
            };
            const isActive = state.activeProvider === p.provider;
            const input = apiKeyInputs[p.provider] ?? { key: "", model: "" };

            return (
              <div
                key={p.provider}
                className="rounded-lg border border-neutral-200 p-4 space-y-4"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{label.name}</span>
                    {p.hasKey ? (
                      <Badge variant="outline" className="text-green-700 border-green-300">
                        Connected
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-neutral-400">
                        Not connected
                      </Badge>
                    )}
                    {isActive && p.hasKey && (
                      <Badge variant="default" className="text-xs">
                        Active
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {bothConnected && !isActive && (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={switching}
                        onClick={() =>
                          void handleSwitch(p.provider as "claude" | "openai")
                        }
                      >
                        {switching ? "Switching…" : "Set as active"}
                      </Button>
                    )}
                    {p.hasKey && (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={!!removing[p.provider]}
                        onClick={() =>
                          void handleRemove(p.provider as "claude" | "openai")
                        }
                      >
                        {removing[p.provider] ? "Removing…" : "Remove"}
                      </Button>
                    )}
                  </div>
                </div>

                {p.hasKey && p.model && (
                  <p className="text-xs text-neutral-500">
                    Model: <span className="font-mono">{p.model}</span>
                  </p>
                )}

                <div className="space-y-3">
                  <div className="space-y-1">
                    <Label htmlFor={`key-${p.provider}`}>
                      {p.hasKey ? "Replace API key" : "Add API key"}
                    </Label>
                    <Input
                      id={`key-${p.provider}`}
                      type="password"
                      placeholder={
                        p.provider === "claude"
                          ? "sk-ant-…"
                          : "sk-proj-…"
                      }
                      value={input.key}
                      onChange={(e) =>
                        setApiKeyInputs((prev) => ({
                          ...prev,
                          [p.provider]: { ...prev[p.provider]!, key: e.target.value },
                        }))
                      }
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor={`model-${p.provider}`}>
                      Model override{" "}
                      <span className="text-neutral-400 font-normal">
                        (optional, default: {label.defaultModel})
                      </span>
                    </Label>
                    <Input
                      id={`model-${p.provider}`}
                      type="text"
                      placeholder={label.defaultModel}
                      value={input.model}
                      onChange={(e) =>
                        setApiKeyInputs((prev) => ({
                          ...prev,
                          [p.provider]: { ...prev[p.provider]!, model: e.target.value },
                        }))
                      }
                    />
                  </div>
                  <Button
                    size="sm"
                    disabled={!input.key.trim() || !!saving[p.provider]}
                    onClick={() =>
                      void handleSaveKey(p.provider as "claude" | "openai")
                    }
                  >
                    {saving[p.provider] ? "Saving…" : p.hasKey ? "Update key" : "Save key"}
                  </Button>
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}
