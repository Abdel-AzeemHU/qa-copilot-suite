"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface CacheEntry {
  id: string;
  originalSelector: string;
  healedSelector: string;
  strategy: string;
  confidence: number;
  hitCount: number;
  lastUsedAt: string;
  createdAt: string;
}

function strategyVariant(strategy: string) {
  if (strategy === "testid") return "high" as const;
  if (strategy === "role") return "info" as const;
  if (strategy === "label") return "info" as const;
  if (strategy === "text") return "medium" as const;
  return "secondary" as const;
}

export function SelectorCachePanel({ projectId }: { projectId: string }) {
  const [open, setOpen] = useState(false);
  const [entries, setEntries] = useState<CacheEntry[]>([]);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/selector-cache`);
      if (res.ok) {
        const data = (await res.json()) as { entries: CacheEntry[] };
        setEntries(data.entries);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const handleDelete = async (cacheId: string) => {
    await fetch(`/api/projects/${projectId}/selector-cache/${cacheId}`, {
      method: "DELETE",
    });
    setEntries((prev) => prev.filter((e) => e.id !== cacheId));
  };

  return (
    <div className="border rounded-lg overflow-hidden">
      <button
        className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium bg-muted/40 hover:bg-muted/60 transition-colors"
        onClick={() => setOpen((v) => !v)}
      >
        <span>Healed Selectors Cache</span>
        <span className="text-muted-foreground">{open ? "▲" : "▼"}</span>
      </button>

      {open && (
        <div className="p-4 space-y-3">
          {loading && (
            <p className="text-sm text-muted-foreground">Loading...</p>
          )}
          {!loading && entries.length === 0 && (
            <p className="text-sm text-muted-foreground">
              No healed selectors yet. Selector healing activates automatically when a locator fails during a test run.
            </p>
          )}
          {!loading && entries.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-muted-foreground border-b">
                    <th className="pb-2 pr-4">Original</th>
                    <th className="pb-2 pr-4">Healed</th>
                    <th className="pb-2 pr-4">Strategy</th>
                    <th className="pb-2 pr-4">Confidence</th>
                    <th className="pb-2 pr-4">Hits</th>
                    <th className="pb-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map((entry) => (
                    <tr key={entry.id} className="border-b last:border-0">
                      <td className="py-2 pr-4 font-mono text-xs max-w-[180px] truncate">
                        {entry.originalSelector}
                      </td>
                      <td className="py-2 pr-4 font-mono text-xs max-w-[180px] truncate text-green-600 dark:text-green-400">
                        {entry.healedSelector}
                      </td>
                      <td className="py-2 pr-4">
                        <Badge variant={strategyVariant(entry.strategy)}>
                          {entry.strategy}
                        </Badge>
                      </td>
                      <td className="py-2 pr-4">
                        {Math.round(entry.confidence * 100)}%
                      </td>
                      <td className="py-2 pr-4">{entry.hitCount}</td>
                      <td className="py-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive hover:text-destructive h-7 px-2"
                          onClick={() => void handleDelete(entry.id)}
                        >
                          Remove
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
