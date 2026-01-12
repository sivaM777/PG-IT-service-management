import { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { pool } from "../../config/db.js";
import { requireAuth } from "../../middlewares/auth.js";

export const kbRoutes: FastifyPluginAsync = async (server) => {
  server.get("/", { preHandler: [requireAuth] }, async (request, reply) => {
    const querySchema = z.object({
      q: z.string().optional(),
      category: z.string().optional(),
      limit: z.coerce.number().int().min(1).max(100).default(25),
    });
    const q = querySchema.parse(request.query);

    const where: string[] = [];
    const params: any[] = [];

    if (q.category) {
      params.push(q.category);
      where.push(`category = $${params.length}`);
    }

    if (q.q) {
      params.push(`%${q.q}%`);
      where.push(`(title ILIKE $${params.length} OR body ILIKE $${params.length})`);
    }

    params.push(q.limit);
    const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

    const res = await pool.query(
      `SELECT id, title, category, tags, updated_at
       FROM kb_articles
       ${whereSql}
       ORDER BY updated_at DESC
       LIMIT $${params.length}`,
      params
    );

    return reply.send(res.rows);
  });

  server.get("/:id", { preHandler: [requireAuth] }, async (request, reply) => {
    const paramsSchema = z.object({ id: z.string().uuid() });
    const p = paramsSchema.parse(request.params);
    const res = await pool.query(
      "SELECT id, title, body, category, tags, created_at, updated_at FROM kb_articles WHERE id = $1",
      [p.id]
    );
    const row = res.rows[0];
    if (!row) return reply.code(404).send({ message: "Not found" });
    return reply.send(row);
  });
};
