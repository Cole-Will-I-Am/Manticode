import type { FastifyInstance } from "fastify";
import { z } from "zod";

const createSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  language: z.string().max(50).optional(),
});

const updateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
  language: z.string().max(50).optional(),
});

const EDITOR_ROLES = ["owner", "editor"] as const;

export default async function projectRoutes(app: FastifyInstance) {
  // List projects in workspace
  app.get("/workspaces/:wid/projects", async (req, reply) => {
    const { wid } = req.params as { wid: string };
    const member = await app.prisma.workspaceMember.findFirst({
      where: { workspaceId: wid, userId: req.userId },
    });
    if (!member) return reply.code(403).send({ error: "Forbidden" });
    return app.prisma.project.findMany({
      where: { workspaceId: wid },
      orderBy: { updatedAt: "desc" },
    });
  });

  // Create project
  app.post("/workspaces/:wid/projects", async (req, reply) => {
    const { wid } = req.params as { wid: string };
    const data = createSchema.parse(req.body);
    const member = await app.prisma.workspaceMember.findFirst({
      where: { workspaceId: wid, userId: req.userId, role: { in: [...EDITOR_ROLES] } },
    });
    if (!member) return reply.code(403).send({ error: "Forbidden" });

    const project = await app.prisma.project.create({ data: { ...data, workspaceId: wid } });

    await app.prisma.activityEvent.create({
      data: {
        workspaceId: wid,
        projectId: project.id,
        userId: req.userId,
        type: "file_created",
        metadata: { action: "project_created", projectName: project.name },
      },
    });

    return project;
  });

  // Get project
  app.get("/projects/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    const project = await app.prisma.project.findUnique({
      where: { id },
      include: { workspace: { include: { members: true } } },
    });
    if (!project) return reply.code(404).send({ error: "Not found" });
    if (!project.workspace.members.some((m) => m.userId === req.userId)) {
      return reply.code(403).send({ error: "Forbidden" });
    }
    return project;
  });

  // Update project
  app.patch("/projects/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    const data = updateSchema.parse(req.body);
    const project = await app.prisma.project.findUnique({
      where: { id },
      include: { workspace: { include: { members: true } } },
    });
    if (!project) return reply.code(404).send({ error: "Not found" });
    const member = project.workspace.members.find((m) => m.userId === req.userId);
    if (!member || member.role === "viewer") return reply.code(403).send({ error: "Forbidden" });
    return app.prisma.project.update({ where: { id }, data });
  });

  // Delete project (owner only)
  app.delete("/projects/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    const project = await app.prisma.project.findUnique({
      where: { id },
      include: { workspace: true },
    });
    if (!project || project.workspace.ownerId !== req.userId) {
      return reply.code(403).send({ error: "Forbidden" });
    }
    await app.prisma.project.delete({ where: { id } });
    return { ok: true };
  });
}
