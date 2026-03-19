import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { streamChat, getModelName } from "../services/ai.js";
import { buildMessages } from "../services/prompt.js";

const sendSchema = z.object({
  content: z.string().min(1).max(10_000),
  attachedFiles: z.array(z.string()).optional(),
});
const EDITOR_ROLES = ["owner", "editor"] as const;

export default async function messageRoutes(app: FastifyInstance) {
  app.post("/threads/:tid/messages", async (req, reply) => {
    const { tid } = req.params as { tid: string };
    const { content, attachedFiles: fileIds } = sendSchema.parse(req.body);

    // Verify thread access + write permission
    const thread = await app.prisma.chatThread.findFirst({
      where: {
        id: tid,
        project: {
          workspace: {
            members: { some: { userId: req.userId, role: { in: [...EDITOR_ROLES] } } },
          },
        },
      },
      include: { project: true },
    });
    if (!thread) return reply.code(404).send({ error: "Thread not found" });

    // Save user message
    await app.prisma.chatMessage.create({
      data: { threadId: tid, role: "user", content, userId: req.userId },
    });

    // Load chat history
    const dbMessages = await app.prisma.chatMessage.findMany({
      where: { threadId: tid },
      orderBy: { createdAt: "asc" },
    });
    const history = dbMessages.map((m) => ({
      role: m.role as "user" | "assistant" | "system",
      content: m.content,
    }));

    // Gather file context
    const files: Array<{ path: string; content: string; language?: string | null }> = [];

    // Explicitly attached files
    if (fileIds?.length) {
      const attached = await app.prisma.file.findMany({
        where: { id: { in: fileIds }, projectId: thread.projectId },
      });
      for (const f of attached) {
        files.push({ path: f.path, content: f.content, language: f.language });
      }
    }

    // Auto-include recent project files (up to 20)
    const projectFiles = await app.prisma.file.findMany({
      where: { projectId: thread.projectId },
      take: 20,
      orderBy: { updatedAt: "desc" },
    });
    for (const f of projectFiles) {
      if (!files.some((af) => af.path === f.path)) {
        files.push({ path: f.path, content: f.content, language: f.language });
      }
    }

    const messages = buildMessages(history.slice(0, -1), content, files);

    // Begin SSE stream
    reply.raw.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    });

    const emit = (type: string, data: string) => {
      reply.raw.write(`data: ${JSON.stringify({ type, data })}\n\n`);
    };

    let fullContent = "";

    try {
      for await (const chunk of streamChat(messages)) {
        if (chunk.content) {
          fullContent += chunk.content;
          emit("delta", chunk.content);
        }

        if (chunk.done) {
          // Persist assistant message
          await app.prisma.chatMessage.create({
            data: { threadId: tid, role: "assistant", content: fullContent },
          });

          // Touch thread timestamp
          await app.prisma.chatThread.update({
            where: { id: tid },
            data: { updatedAt: new Date() },
          });

          // Track usage
          if (chunk.promptTokens || chunk.completionTokens) {
            await app.prisma.usageRecord.create({
              data: {
                userId: req.userId,
                model: getModelName(),
                promptTokens: chunk.promptTokens ?? 0,
                completionTokens: chunk.completionTokens ?? 0,
              },
            });
          }

          emit("done", JSON.stringify({
            promptTokens: chunk.promptTokens ?? 0,
            completionTokens: chunk.completionTokens ?? 0,
          }));
        }
      }
    } catch (err) {
      emit("error", (err as Error).message);
    }

    reply.raw.write("data: [DONE]\n\n");
    reply.raw.end();
  });
}
