import type { FastifyInstance } from "fastify";
import { z } from "zod";

const createSchema = z.object({
  path: z.string().min(1).max(500),
  content: z.string().default(""),
  language: z.string().max(50).optional(),
});
const updateSchema = z.object({ content: z.string() });
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

export default async function fileRoutes(app: FastifyInstance) {
  // List files
  app.get("/projects/:pid/files", async (req, reply) => {
    const { pid } = req.params as { pid: string };
    if (!(await canRead(app, pid, req.userId))) return reply.code(403).send({ error: "Forbidden" });
    return app.prisma.file.findMany({ where: { projectId: pid }, orderBy: { path: "asc" } });
  });

  // Create file
  app.post("/projects/:pid/files", async (req, reply) => {
    const { pid } = req.params as { pid: string };
    const data = createSchema.parse(req.body);
    if (!(await canEdit(app, pid, req.userId))) return reply.code(403).send({ error: "Forbidden" });

    const file = await app.prisma.file.create({ data: { projectId: pid, ...data } });
    await app.prisma.fileVersion.create({
      data: { fileId: file.id, content: data.content, version: 1, createdById: req.userId },
    });
    return file;
  });

  // Upload files (multipart)
  app.post("/projects/:pid/files/upload", async (req, reply) => {
    const { pid } = req.params as { pid: string };
    if (!(await canEdit(app, pid, req.userId))) return reply.code(403).send({ error: "Forbidden" });

    const parts = req.parts();
    const files = [];

    for await (const part of parts) {
      if (part.type === "file") {
        const content = (await part.toBuffer()).toString("utf-8");
        const path = part.filename || "untitled";

        const file = await app.prisma.file.upsert({
          where: { projectId_path: { projectId: pid, path } },
          update: { content },
          create: { projectId: pid, path, content },
        });

        const lastVersion = await app.prisma.fileVersion.findFirst({
          where: { fileId: file.id },
          orderBy: { version: "desc" },
        });
        await app.prisma.fileVersion.create({
          data: {
            fileId: file.id,
            content,
            version: (lastVersion?.version ?? 0) + 1,
            createdById: req.userId,
          },
        });

        files.push(file);
      }
    }

    return { uploaded: files.length, files };
  });

  // Get file with versions
  app.get("/files/:fid", async (req, reply) => {
    const { fid } = req.params as { fid: string };
    const file = await app.prisma.file.findFirst({
      where: { id: fid, project: { workspace: { members: { some: { userId: req.userId } } } } },
      include: { versions: { orderBy: { version: "desc" }, take: 10 } },
    });
    if (!file) return reply.code(404).send({ error: "Not found" });
    return file;
  });

  // Update file content
  app.put("/files/:fid", async (req, reply) => {
    const { fid } = req.params as { fid: string };
    const { content } = updateSchema.parse(req.body);

    const existing = await app.prisma.file.findFirst({
      where: {
        id: fid,
        project: { workspace: { members: { some: { userId: req.userId, role: { in: [...EDITOR_ROLES] } } } } },
      },
    });
    if (!existing) return reply.code(404).send({ error: "Not found" });

    const file = await app.prisma.file.update({ where: { id: fid }, data: { content } });

    const lastVersion = await app.prisma.fileVersion.findFirst({
      where: { fileId: fid },
      orderBy: { version: "desc" },
    });
    await app.prisma.fileVersion.create({
      data: {
        fileId: fid,
        content,
        version: (lastVersion?.version ?? 0) + 1,
        createdById: req.userId,
      },
    });

    return file;
  });

  // Delete file
  app.delete("/files/:fid", async (req, reply) => {
    const { fid } = req.params as { fid: string };
    const existing = await app.prisma.file.findFirst({
      where: {
        id: fid,
        project: { workspace: { members: { some: { userId: req.userId, role: { in: [...EDITOR_ROLES] } } } } },
      },
    });
    if (!existing) return reply.code(404).send({ error: "Not found" });
    await app.prisma.file.delete({ where: { id: fid } });
    return { ok: true };
  });
}
