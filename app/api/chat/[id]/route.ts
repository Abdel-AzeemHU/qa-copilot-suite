import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";
import { auth } from "@/auth";
import { prisma } from "@/lib/db/prisma";
import { decrypt } from "@/lib/crypto";
import { getProjectChatContext } from "@/lib/data";

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

  // Resolve the active provider key record for this user.
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { activeProvider: true },
  });
  const activeProvider = user?.activeProvider ?? "claude";

  const keyRecord = await prisma.apiKey.findFirst({
    where: { userId: session.user.id, provider: activeProvider },
    select: { encryptedKey: true, provider: true, config: true },
  });
  if (!keyRecord) {
    // Fall back to any stored key.
    const fallbackRecord = await prisma.apiKey.findFirst({
      where: { userId: session.user.id },
      select: { encryptedKey: true, provider: true, config: true },
    });
    if (!fallbackRecord) {
      return new Response("No API key found. Add one in Settings.", { status: 400 });
    }
    Object.assign(keyRecord ?? {}, fallbackRecord);
  }
  if (!keyRecord) {
    return new Response("No API key found. Add one in Settings.", { status: 400 });
  }
  const apiKey = decrypt(keyRecord.encryptedKey);
  const modelFromConfig = keyRecord.config
    ? (JSON.parse(keyRecord.config) as { model?: string }).model
    : undefined;

  // Persist the user's message.
  await prisma.chatMessage.create({
    data: { projectId: id, role: "user", content: message },
  });

  const systemPrompt = buildSystemPrompt(project);
  const history = project.chatMessages.map((m) => ({
    role: m.role === "assistant" ? ("assistant" as const) : ("user" as const),
    content: m.content,
  }));

  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let assistantText = "";
      const sse = (data: string) =>
        controller.enqueue(encoder.encode(`data: ${data}\n\n`));

      try {
        if (keyRecord.provider === "openai") {
          const openaiClient = new OpenAI({ apiKey });
          const openaiModel = modelFromConfig ?? "gpt-4o";
          const openaiStream = await openaiClient.chat.completions.create({
            model: openaiModel,
            max_tokens: 4096,
            stream: true,
            messages: [
              { role: "system", content: systemPrompt },
              ...history,
              { role: "user", content: message },
            ],
          });
          for await (const chunk of openaiStream) {
            const text = chunk.choices[0]?.delta?.content ?? "";
            if (text) {
              assistantText += text;
              sse(JSON.stringify(text));
            }
          }
        } else {
          const claudeClient = new Anthropic({ apiKey });
          const claudeModel = modelFromConfig ?? MODEL;
          const messageStream = claudeClient.messages.stream({
            model: claudeModel,
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
