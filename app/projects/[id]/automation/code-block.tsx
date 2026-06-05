"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

interface GeneratedFile {
  filename: string;
  language: string;
  content: string;
}

export function CodeBlock({ file }: { file: GeneratedFile }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(file.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // ignore clipboard errors
    }
  };

  return (
    <div className="rounded-md border border-neutral-200">
      <div className="flex items-center justify-between border-b border-neutral-200 bg-neutral-50 px-3 py-2">
        <span className="font-mono text-xs text-neutral-700">
          {file.filename}
        </span>
        <Button type="button" variant="outline" size="sm" onClick={copy}>
          {copied ? "Copied" : "Copy"}
        </Button>
      </div>
      <pre className="overflow-x-auto p-3 text-xs leading-relaxed">
        <code>{file.content}</code>
      </pre>
    </div>
  );
}
