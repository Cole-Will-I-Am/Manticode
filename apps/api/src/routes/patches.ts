import type { FastifyInstance } from "fastify";
import { parseCodeBlocks, generateDiff } from "../services/patch-parser.js";

const EDITOR_ROLES = ["owner", "editor"] as const;

async function canRead(app: FastifyInstance, projectId: string, userId: string) {
  return !!(await app.prisma.project.findFirst({
    where: { id: projectId, workspace: { members: { some: { userId } } } },
    select: { id: true },
  }));
}

async function canEdit(app: FastifyInstance, projectId: string, userId: string) {
  return !!(await app.prisma.project.findFirst({
    where: {
      id: projectId,
      workspace: { members: { some: { userId, role: { in: [...EDITOR_ROLES] } } } },
    },
    select: { id: true },
  }));
}

export default async function patchRoutes(app: FastifyInstance) {
  // List patches for project
  app.get("/projects/:pid/patches", async (req, reply) => {
    const { pid } = req.params as { pid: string };
    if (!(await canRead(app, pid, req.userId))) return reply.code(403).send({ error: "Forbidden" });
    return app.prisma.patchProposal.findMany({
      where: { projectId: pid },
      orderBy: { createdAt: "desc" },
      include: { changes: true, createdBy: true },
    });
  });

  // Get patch detail
  app.get("/patches/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    const patch = await app.prisma.patchProposal.findFirst({
      where: { id, project: { workspace: { members: { some: { userId: req.userId } } } } },
      include: { changes: true, createdBy: true, message: true },
    });
    if (!patch) return reply.code(404).send({ error: "Not found" });
    return patch;
  });

  // Parse patch from AI message
  app.post("/patches/from-message", async (req, reply) => {
    const { messageId, projectId, threadId } = req.body as {
      messageId: string;
      projectId: string;
      threadId: string;
    };
    if (!(await canEdit(app, projectId, req.userId))) {
      return reply.code(403).send({ error: "Forbidden" });
    }

    const message = await app.prisma.chatMessage.findFirst({
      where: { id: messageId, threadId, thread: { projectId } },
    });
    if (!message) return reply.code(404).send({ error: "Message not found" });

    const parsed = parseCodeBlocks(message.content);
    if (parsed.length === 0) return { created: false };

    const changeData = [];
    for (const change of parsed) {
      const existingFile = await app.prisma.file.findFirst({
        where: { projectId, path: change.filePath },
      });
      const action = existingFile ? "modify" : "create";
      const oldContent = existingFile?.content || "";
      const diff = generateDiff(change.filePath, oldContent, change.newContent);

      changeData.push({
        fileId: existingFile?.id ?? null,
        filePath: change.filePath,
        action,
        diff,
        newContent: change.newContent,
      });
    }

    const patch = await app.prisma.patchProposal.create({
      data: {
        projectId,
        threadId,
        messageId,
        title: `Code changes (${changeData.length} file${changeData.length > 1 ? "s" : ""})`,
        createdById: req.userId,
        changes: { create: changeData },
      },
      include: { changes: true },
    });

    return { created: true, patch };
  });

  // Approve patch
  app.post("/patches/:id/approve", async (req, reply) => {
    const { id } = req.params as { id: string };
    const patch = await app.prisma.patchProposal.findFirst({
      where: {
        id,
        project: { workspace: { members: { some: { userId: req.userId, role: { in: [...EDITOR_ROLES] } } } } },
      },
    });
    if (!patch) return reply.code(404).send({ error: "Not found" });
    if (patch.status !== "pending") return reply.code(400).send({ error: "Patch is not pending" });
    return app.prisma.patchProposal.update({ where: { id }, data: { status: "approved" } });
  });

  // Reject patch
  app.post("/patches/:id/reject", async (req, reply) => {
    const { id } = req.params as { id: string };
    const patch = await app.prisma.patchProposal.findFirst({
      where: {
        id,
        project: { workspace: { members: { some: { userId: req.userId, role: { in: [...EDITOR_ROLES] } } } } },
      },
    });
    if (!patch) return reply.code(404).send({ error: "Not found" });
    return app.prisma.patchProposal.update({ where: { id }, data: { status: "rejected" } });
  });

  // Apply patch — update files
  app.post("/patches/:id/apply", async (req, reply) => {
    const { id } = req.params as { id: string };
    const patch = await app.prisma.patchProposal.findFirst({
      where: {
        id,
        project: { workspace: { members: { some: { userId: req.userId, role: { in: [...EDITOR_ROLES] } } } } },
      },
      include: { changes: true },
    });
    if (!patch) return reply.code(404).send({ error: "Not found" });
    if (patch.status !== "approved") return reply.code(400).send({ error: "Patch must be approved first" });

    for (const change of patch.changes) {
      if (change.action === "create") {
        const file = await app.prisma.file.create({
          data: { projectId: patch.projectId, path: change.filePath, content: change.newContent },
        });
        await app.prisma.fileVersion.create({
          data: { fileId: file.id, content: change.newContent, version: 1, createdById: req.userId },
        });
      } else if (change.action === "modify" && change.fileId) {
        await app.prisma.file.update({
          where: { id: change.fileId },
          data: { content: change.newContent },
        });
        const lastVersion = await app.prisma.fileVersion.findFirst({
          where: { fileId: change.fileId },
          orderBy: { version: "desc" },
        });
        await app.prisma.fileVersion.create({
          data: {
            fileId: change.fileId,
            content: change.newContent,
            version: (lastVersion?.version ?? 0) + 1,
            createdById: req.userId,
          },
        });
      } else if (change.action === "delete" && change.fileId) {
        await app.prisma.file.delete({ where: { id: change.fileId } });
      }
    }

    const updated = await app.prisma.patchProposal.update({
      where: { id },
      data: { status: "applied" },
      include: { changes: true },
    });

    // Audit log
    const project = await app.prisma.project.findUnique({ where: { id: patch.projectId } });
    if (project) {
      await app.prisma.activityEvent.create({
        data: {
          workspaceId: project.workspaceId,
          projectId: patch.projectId,
          userId: req.userId,
          type: "patch_applied",
          metadata: { patchId: id, filesChanged: patch.changes.length },
        },
      });
    }

    return updated;
  });
}
