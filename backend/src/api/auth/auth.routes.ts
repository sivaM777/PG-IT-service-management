import { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { env } from "../../config/env.js";
import {
  findUserByEmail,
  findUserById,
  verifyPassword,
  toPublicUser,
  createRefreshToken,
  rotateRefreshToken,
  revokeRefreshToken,
} from "../../services/auth/auth.service.js";
import { requireAuth } from "../../middlewares/auth.js";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const refreshCookieName = "refresh_token";
const refreshTtlDays = env.REFRESH_TOKEN_TTL_DAYS;
const accessTtl = env.ACCESS_TOKEN_TTL;

const mobileClientHeader = "x-client-platform";
const mobileClientValue = "mobile";

const refreshBodySchema = z
  .object({
    refresh_token: z.string().min(1).optional(),
  })
  .optional();

export const authRoutes: FastifyPluginAsync = async (server) => {
  server.post("/login", async (request, reply) => {
    const body = loginSchema.parse(request.body);

    const isMobileClient =
      String((request.headers as Record<string, unknown>)[mobileClientHeader] ?? "").toLowerCase() ===
      mobileClientValue;

    const user = await findUserByEmail(body.email);
    if (!user) {
      return reply.code(401).send({ message: "Invalid credentials" });
    }

    const ok = await verifyPassword(body.password, user.password_hash);
    if (!ok) {
      return reply.code(401).send({ message: "Invalid credentials" });
    }

    const publicUser = toPublicUser(user);
    const token = await reply.jwtSign(publicUser, { expiresIn: accessTtl });

    const refresh = await createRefreshToken(user.id, refreshTtlDays);

    if (!isMobileClient) {
      reply.setCookie(refreshCookieName, refresh.token, {
        httpOnly: true,
        sameSite: "lax",
        secure: env.NODE_ENV === "production",
        path: "/api/v1/auth",
        maxAge: refreshTtlDays * 24 * 60 * 60,
      });
      return reply.send({ token, user: publicUser });
    }

    return reply.send({ token, user: publicUser, refresh_token: refresh.token });
  });

  server.get("/me", { preHandler: [requireAuth] }, async (request, reply) => {
    const u = request.authUser;
    if (!u) return reply.code(401).send({ message: "Unauthorized" });

    const dbUser = await findUserById(u.id);
    if (!dbUser) return reply.code(401).send({ message: "Unauthorized" });

    return reply.send(toPublicUser(dbUser));
  });

  server.post("/refresh", async (request, reply) => {
    const parsed = refreshBodySchema.parse(request.body);
    const raw = request.cookies?.[refreshCookieName] ?? parsed?.refresh_token;
    if (!raw) return reply.code(401).send({ message: "Unauthorized" });

    const rotated = await rotateRefreshToken(raw, refreshTtlDays);
    if (!rotated) return reply.code(401).send({ message: "Unauthorized" });

    const dbUser = await findUserById(rotated.userId);
    if (!dbUser) return reply.code(401).send({ message: "Unauthorized" });

    const publicUser = toPublicUser(dbUser);
    const token = await reply.jwtSign(publicUser, { expiresIn: accessTtl });

    const isMobileClient =
      String((request.headers as Record<string, unknown>)[mobileClientHeader] ?? "").toLowerCase() ===
      mobileClientValue;

    if (!isMobileClient) {
      reply.setCookie(refreshCookieName, rotated.token, {
        httpOnly: true,
        sameSite: "lax",
        secure: env.NODE_ENV === "production",
        path: "/api/v1/auth",
        maxAge: refreshTtlDays * 24 * 60 * 60,
      });
      return reply.send({ token, user: publicUser });
    }

    return reply.send({ token, user: publicUser, refresh_token: rotated.token });
  });

  server.post("/logout", async (request, reply) => {
    const parsed = refreshBodySchema.parse(request.body);
    const raw = request.cookies?.[refreshCookieName] ?? parsed?.refresh_token;
    if (raw) {
      await revokeRefreshToken(raw);
    }

    reply.clearCookie(refreshCookieName, { path: "/api/v1/auth" });
    return reply.send({ ok: true });
  });
};
