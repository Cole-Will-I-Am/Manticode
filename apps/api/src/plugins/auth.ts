import fp from "fastify-plugin";
import jwt from "jsonwebtoken";
import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";

const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-change-me";
const JWT_EXPIRES_IN = "7d";

declare module "fastify" {
  interface FastifyRequest {
    userId: string;
  }
}

export function signToken(userId: string): string {
  return jwt.sign({ sub: userId }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

export function verifyToken(token: string): { sub: string } {
  return jwt.verify(token, JWT_SECRET) as { sub: string };
}

export default fp(async (app: FastifyInstance) => {
  app.decorateRequest("userId", "");

  app.addHook("onRequest", async (req: FastifyRequest, reply: FastifyReply) => {
    // Skip auth for public routes
    const publicPaths = ["/api/auth/", "/api/health", "/api/ready", "/health"];
    if (publicPaths.some((p) => req.url.startsWith(p))) return;

    const header = req.headers.authorization;
    if (!header?.startsWith("Bearer ")) {
      return reply.code(401).send({ error: "Unauthorized", message: "Missing token" });
    }

    try {
      const payload = verifyToken(header.slice(7));
      req.userId = payload.sub;
    } catch {
      return reply.code(401).send({ error: "Unauthorized", message: "Invalid token" });
    }
  });
});
