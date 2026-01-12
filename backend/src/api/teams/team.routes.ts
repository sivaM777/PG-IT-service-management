import { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { pool } from "../../config/db.js";
import { requireAuth, requireRole } from "../../middlewares/auth.js";

export const teamRoutes: FastifyPluginAsync = async (server) => {
  const teamSchema = z.object({
    name: z.string().min(1).max(100),
  });

  server.get(
    "/",
    { preHandler: [requireAuth, requireRole(["ADMIN", "AGENT"]) ] },
    async (_request, reply) => {
      const res = await pool.query(
        "SELECT id, name, created_at FROM teams ORDER BY name ASC"
      );
      return reply.send(res.rows);
    }
  );

  server.post(
    "/",
    { preHandler: [requireAuth, requireRole(["ADMIN"]) ] },
    async (request, reply) => {
      const body = teamSchema.parse(request.body);

      const exists = await pool.query<{ id: string }>(
        "SELECT id FROM teams WHERE lower(name) = lower($1) LIMIT 1",
        [body.name]
      );
      if (exists.rows[0]) return reply.code(409).send({ message: "Team already exists" });

      const res = await pool.query(
        "INSERT INTO teams (name) VALUES ($1) RETURNING id, name, created_at",
        [body.name]
      );
      return reply.code(201).send(res.rows[0]);
    }
  );

  server.patch(
    "/:id",
    { preHandler: [requireAuth, requireRole(["ADMIN"]) ] },
    async (request, reply) => {
      const id = (request.params as any).id as string;
      const body = teamSchema.parse(request.body);

      const exists = await pool.query<{ id: string }>(
        "SELECT id FROM teams WHERE lower(name) = lower($1) AND id <> $2 LIMIT 1",
        [body.name, id]
      );
      if (exists.rows[0]) return reply.code(409).send({ message: "Team already exists" });

      const res = await pool.query(
        "UPDATE teams SET name = $2 WHERE id = $1 RETURNING id, name, created_at",
        [id, body.name]
      );
      const row = res.rows[0] ?? null;
      if (!row) return reply.code(404).send({ message: "Not found" });
      return reply.send(row);
    }
  );

  server.delete(
    "/:id",
    { preHandler: [requireAuth, requireRole(["ADMIN"]) ] },
    async (request, reply) => {
      const id = (request.params as any).id as string;
      try {
        const res = await pool.query("DELETE FROM teams WHERE id = $1", [id]);
        if (res.rowCount === 0) return reply.code(404).send({ message: "Not found" });
        return reply.code(204).send();
      } catch {
        return reply.code(409).send({ message: "Team is in use" });
      }
    }
  );
};
