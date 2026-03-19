import type { FastifyInstance } from "fastify";
import { z } from "zod";

const createSchema = z.object({ name: z.string().min(1).max(100) });
const updateSchema = z.object({ name: z.string().min(1).max(100).optional() });
const inviteSchema = z.object({
  username: z.string(),
  role: z.enum(["editor", "viewer"]).default("editor"),
});

export default async function workspaceRoutes(app: FastifyInstance) {
  // List user's workspaces
  app.get("/", async (req) => {
    const memberships = await app.prisma.workspaceMember.findMany({
      where: { userId: req.userId },
      include: { workspace: true },
    });
    return memberships.map((m) => m.workspace);
  });

  // Create workspace
  app.post("/", async (req) => {
    const { name } = createSchema.parse(req.body);
    return app.prisma.workspace.create({
      data: {
        name,
        ownerId: req.userId,
        members: { create: { userId: req.userId, role: "owner" } },
      },
    });
  });

  // Get workspace with members
  app.get("/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    const ws = await app.prisma.workspace.findFirst({
      where: { id, members: { some: { userId: req.userId } } },
      include: { members: { include: { user: true } } },
    });
    if (!ws) return reply.code(404).send({ error: "Not found" });
    return ws;
  });

  // Update workspace (owner only)
  app.patch("/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    const data = updateSchema.parse(req.body);
    const ws = await app.prisma.workspace.findFirst({ where: { id, ownerId: req.userId } });
    if (!ws) return reply.code(403).send({ error: "Forbidden" });
    return app.prisma.workspace.update({ where: { id }, data });
  });

  // Delete workspace (owner only)
  app.delete("/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    const ws = await app.prisma.workspace.findFirst({ where: { id, ownerId: req.userId } });
    if (!ws) return reply.code(403).send({ error: "Forbidden" });
    await app.prisma.workspace.delete({ where: { id } });
    return { ok: true };
  });

  // Invite member (owner only)
  app.post("/:id/members", async (req, reply) => {
    const { id } = req.params as { id: string };
    const { username, role } = inviteSchema.parse(req.body);

    const isOwner = await app.prisma.workspaceMember.findFirst({
      where: { workspaceId: id, userId: req.userId, role: "owner" },
    });
    if (!isOwner) return reply.code(403).send({ error: "Forbidden" });

    const target = await app.prisma.user.findFirst({ where: { username } });
    if (!target) return reply.code(404).send({ error: "User not found" });

    return app.prisma.workspaceMember.upsert({
      where: { workspaceId_userId: { workspaceId: id, userId: target.id } },
      update: { role },
      create: { workspaceId: id, userId: target.id, role },
    });
  });

  // Remove member (owner only)
  app.delete("/:id/members/:memberId", async (req, reply) => {
    const { id, memberId } = req.params as { id: string; memberId: string };

    const isOwner = await app.prisma.workspaceMember.findFirst({
      where: { workspaceId: id, userId: req.userId, role: "owner" },
    });
    if (!isOwner) return reply.code(403).send({ error: "Forbidden" });

    await app.prisma.workspaceMember.delete({ where: { id: memberId } });
    return { ok: true };
  });
}
