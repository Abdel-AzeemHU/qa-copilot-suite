import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { getProjectChatContext } from "@/lib/data";
import { AppHeader } from "@/components/app-header";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ChatPanel, type ChatMessageView } from "./chat-panel";

export default async function ChatPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const { id } = await params;
  const project = await getProjectChatContext(id, session.user.id);
  if (!project) notFound();

  const history: ChatMessageView[] = project.chatMessages.map((m) => ({
    id: m.id,
    role: m.role === "assistant" ? "assistant" : "user",
    content: m.content,
  }));

  return (
    <>
      <AppHeader />
      <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-8">
        <Card>
          <CardHeader>
            <CardTitle>QA Chat Assist</CardTitle>
            <CardDescription>
              {project.name} — grounded in this project&apos;s test cases and plans
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ChatPanel projectId={project.id} initialMessages={history} />
          </CardContent>
        </Card>
      </main>
    </>
  );
}
