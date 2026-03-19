import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { validateInitData } from "../services/telegram-auth.js";
import { signToken } from "../plugins/auth.js";

const loginSchema = z.object({ initData: z.string() });

export default async function authRoutes(app: FastifyInstance) {
  app.post("/telegram", async (req, reply) => {
    const { initData } = loginSchema.parse(req.body);

    let validated;
    try {
      validated = validateInitData(initData);
    } catch (e) {
      return reply.code(401).send({ error: "Unauthorized", message: (e as Error).message });
    }

    const { user: tg } = validated;
    const telegramId = String(tg.id);
    const displayName = [tg.first_name, tg.last_name].filter(Boolean).join(" ");

    // Upsert user
    const user = await app.prisma.user.upsert({
      where: { telegramId },
      update: { username: tg.username ?? null, displayName, avatarUrl: tg.photo_url ?? null },
      create: { telegramId, username: tg.username ?? null, displayName, avatarUrl: tg.photo_url ?? null },
    });

    // Create default workspace on first login
    const hasMembership = await app.prisma.workspaceMember.findFirst({
      where: { userId: user.id },
    });

    if (!hasMembership) {
      await app.prisma.workspace.create({
        data: {
          name: `${tg.first_name}'s Workspace`,
          ownerId: user.id,
          members: { create: { userId: user.id, role: "owner" } },
        },
      });
    }

    return {
      token: signToken(user.id),
      user: {
        id: user.id,
        telegramId: user.telegramId,
        username: user.username,
        displayName: user.displayName,
        avatarUrl: user.avatarUrl,
        createdAt: user.createdAt.toISOString(),
      },
    };
  });
}
