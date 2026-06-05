import Anthropic from "@anthropic-ai/sdk";
import { auth } from "@/auth";
import { prisma } from "@/lib/db/prisma";
import { decrypt } from "@/lib/crypto";
import { getProjectChatContext, getClaudeApiKeyRecord } from "@/lib/data";

const MODEL = "claude-opus-4-8";

function buildSystemPrompt(project: {
  name: string;
  description: string | null;
  testCases: Array<{
    title: string;
    steps: string;
    expectedResult: string | null;
    type: string;
    priority: string;
  }>;
  testPlans: Array<{ output: string }>;
}): string {
  const lines: string[] = [];
  lines.push(
    "You are a QA copilot assistant grounded in the context of a specific software project.",
  );
  lines.push("Answer questions about testing, QA strategy, and the project.");
  lines.push("");
  lines.push(`Project: ${project.name}`);
  if (project.description) lines.push(`Description: ${project.description}`);

  if (project.testCases.length) {
    lines.push("");
    lines.push("Test cases in this project:");
    project.testCases.forEach((tc, i) => {
      lines.push(
        `${i + 1}. [${tc.type}/${tc.priority}] ${tc.title} — expected: ${
          tc.expectedResult ?? "n/a"
        }`,
      );
    });
  }

  if (project.testPlans.length) {
    lines.push("");
    lines.push("Latest test plan (JSON):");
    lines.push(project.testPlans[0].output);
  }

  return lines.join("\n");
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const session = await auth();
  if (!session?.user) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { id } = await params;
  const project = await getProjectChatContext(id, session.user.id);
  if (!project) {
    return new Response("Not found", { status: 404 });
  }

  let body: { message?: unknown };
  try {
    body = (await request.json()) as { message?: unknown };
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }
  const message = typeof body.message === "string" ? body.message.trim() : "";
  if (!message) {
    return new Response("A message is required", { status: 400 });
  }

  const keyRecord = await getClaudeApiKeyRecord(session.user.id);
  if (!keyRecord) {
    return new Response("No Claude API key found", { status: 400 });
  }
  const apiKey = decrypt(keyRecord.encryptedKey);

  // Persist the user's message.
  await prisma.chatMessage.create({
    data: { projectId: id, role: "user", content: message },
  });

  const systemPrompt = buildSystemPrompt(project);
  const history = project.chatMessages.map((m) => ({
    role: m.role === "assistant" ? ("assistant" as const) : ("user" as const),
    content: m.content,
  }));

  const client = new Anthropic({ apiKey });
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let assistantText = "";
      const sse = (data: string) =>
        controller.enqueue(encoder.encode(`data: ${data}\n\n`));

      try {
        const messageStream = client.messages.stream({
          model: MODEL,
          max_tokens: 4096,
          system: systemPrompt,
          messages: [...history, { role: "user", content: message }],
        });

        for await (const event of messageStream) {
          if (
            event.type === "content_block_delta" &&
            event.delta.type === "text_delta"
          ) {
            assistantText += event.delta.text;
            sse(JSON.stringify(event.delta.text));
          }
        }
        sse("[DONE]");
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Streaming failed";
        sse(JSON.stringify(`\n[Error: ${msg}]`));
      } finally {
        if (assistantText) {
          await prisma.chatMessage.create({
            data: { projectId: id, role: "assistant", content: assistantText },
          });
        }
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
