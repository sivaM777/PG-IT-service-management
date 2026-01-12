import { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { pool } from "../../config/db.js";
import { requireAuth } from "../../middlewares/auth.js";

type NotificationRow = {
  id: string;
  user_id: string;
  ticket_id: string | null;
  type: "TICKET_CREATED" | "TICKET_ASSIGNED" | "TICKET_STATUS_CHANGED";
  title: string;
  body: string;
  read_at: string | null;
  created_at: string;
};

export const notificationRoutes: FastifyPluginAsync = async (server) => {
  server.get("/", { preHandler: [requireAuth] }, async (request, reply) => {
    const u = request.authUser!;

    const querySchema = z.object({
      limit: z.coerce.number().int().min(1).max(200).default(50),
      offset: z.coerce.number().int().min(0).default(0),
      unreadOnly: z
        .union([z.literal("true"), z.literal("false")])
        .optional()
        .transform((v) => v === "true"),
    });

    const q = querySchema.parse(request.query);

    const res = await pool.query<NotificationRow>(
      `SELECT id, user_id, ticket_id, type, title, body, read_at, created_at
       FROM notifications
       WHERE user_id = $1
         AND ($2::boolean IS NOT TRUE OR read_at IS NULL)
       ORDER BY created_at DESC
       LIMIT $3 OFFSET $4`,
      [u.id, q.unreadOnly, q.limit, q.offset]
    );

    return reply.send(res.rows);
  });

  server.get("/unread-count", { preHandler: [requireAuth] }, async (request, reply) => {
    const u = request.authUser!;
    const res = await pool.query<{ count: string }>(
      "SELECT COUNT(*)::text AS count FROM notifications WHERE user_id = $1 AND read_at IS NULL",
      [u.id]
    );
    const count = Number(res.rows[0]?.count ?? 0);
    return reply.send({ count });
  });

  server.post("/:id/read", { preHandler: [requireAuth] }, async (request, reply) => {
    const u = request.authUser!;
    const paramsSchema = z.object({ id: z.string().uuid() });
    const params = paramsSchema.parse(request.params);

    const res = await pool.query<NotificationRow>(
      `UPDATE notifications
       SET read_at = now()
       WHERE id = $1 AND user_id = $2 AND read_at IS NULL
       RETURNING id, user_id, ticket_id, type, title, body, read_at, created_at`,
      [params.id, u.id]
    );

    if (!res.rows[0]) {
      return reply.code(404).send({ message: "Notification not found" });
    }
    return reply.send(res.rows[0]);
  });

  server.post("/read-all", { preHandler: [requireAuth] }, async (request, reply) => {
    const u = request.authUser!;
    await pool.query(
      `UPDATE notifications
       SET read_at = now()
       WHERE user_id = $1 AND read_at IS NULL`,
      [u.id]
    );

    return reply.send({ ok: true });
  });
};
