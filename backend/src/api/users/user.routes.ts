import { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { pool } from "../../config/db.js";
import { requireAuth, requireRole } from "../../middlewares/auth.js";
import { hashPassword } from "../../services/auth/auth.service.js";

export const userRoutes: FastifyPluginAsync = async (server) => {
  // Minimal placeholder; user management would be expanded later.
  server.get("/me", { preHandler: [requireAuth] }, async (request, reply) => {
    return reply.send(request.authUser);
  });

  const createUserSchema = z.object({
    name: z.string().min(1).max(100),
    email: z.string().email(),
    password: z.string().min(6).max(200),
    role: z.enum(["EMPLOYEE", "AGENT", "ADMIN"]),
    team_id: z.string().uuid().nullable().optional(),
  });

  const updateUserSchema = z.object({
    name: z.string().min(1).max(100).optional(),
    email: z.string().email().optional(),
    password: z.string().min(6).max(200).optional(),
    role: z.enum(["EMPLOYEE", "AGENT", "ADMIN"]).optional(),
    team_id: z.string().uuid().nullable().optional(),
  });

  server.get(
    "/",
    { preHandler: [requireAuth, requireRole(["ADMIN", "AGENT"]) ] },
    async (request, reply) => {
      const querySchema = z.object({
        role: z.enum(["EMPLOYEE", "AGENT", "ADMIN"]).optional(),
      });

      const q = querySchema.parse(request.query);

      if (q.role) {
        const res = await pool.query(
          "SELECT id, name, email, role, team_id, created_at FROM users WHERE role = $1 ORDER BY name ASC",
          [q.role]
        );
        return reply.send(res.rows);
      }

      const res = await pool.query(
        "SELECT id, name, email, role, team_id, created_at FROM users ORDER BY name ASC"
      );
      return reply.send(res.rows);
    }
  );

  server.get(
    "/:id",
    { preHandler: [requireAuth, requireRole(["ADMIN"]) ] },
    async (request, reply) => {
      const id = (request.params as any).id as string;
      const res = await pool.query(
        "SELECT id, name, email, role, team_id, created_at FROM users WHERE id = $1",
        [id]
      );
      const row = res.rows[0] ?? null;
      if (!row) return reply.code(404).send({ message: "Not found" });
      return reply.send(row);
    }
  );

  server.post(
    "/",
    { preHandler: [requireAuth, requireRole(["ADMIN"]) ] },
    async (request, reply) => {
      const body = createUserSchema.parse(request.body);
      const passwordHash = await hashPassword(body.password);
      try {
        const res = await pool.query(
          `INSERT INTO users (name, email, password_hash, role, team_id)
           VALUES ($1, $2, $3, $4, $5)
           RETURNING id, name, email, role, team_id, created_at`,
          [body.name, body.email.toLowerCase(), passwordHash, body.role, body.team_id ?? null]
        );
        return reply.code(201).send(res.rows[0]);
      } catch (e: any) {
        if (String(e?.code) === "23505") {
          return reply.code(409).send({ message: "Email already exists" });
        }
        return reply.code(500).send({ message: "Error" });
      }
    }
  );

  server.patch(
    "/:id",
    { preHandler: [requireAuth, requireRole(["ADMIN"]) ] },
    async (request, reply) => {
      const id = (request.params as any).id as string;
      const body = updateUserSchema.parse(request.body);

      const existing = await pool.query(
        "SELECT id, name, email, role, team_id, created_at FROM users WHERE id = $1",
        [id]
      );
      if (!existing.rows[0]) return reply.code(404).send({ message: "Not found" });

      const updates: string[] = [];
      const values: any[] = [id];
      let idx = 2;

      if (body.name !== undefined) {
        updates.push(`name = $${idx}`);
        values.push(body.name);
        idx += 1;
      }
      if (body.email !== undefined) {
        updates.push(`email = $${idx}`);
        values.push(body.email.toLowerCase());
        idx += 1;
      }
      if (body.role !== undefined) {
        updates.push(`role = $${idx}`);
        values.push(body.role);
        idx += 1;
      }
      if (body.team_id !== undefined) {
        updates.push(`team_id = $${idx}`);
        values.push(body.team_id);
        idx += 1;
      }
      if (body.password !== undefined) {
        const passwordHash = await hashPassword(body.password);
        updates.push(`password_hash = $${idx}`);
        values.push(passwordHash);
        idx += 1;
      }

      if (updates.length === 0) {
        return reply.send(existing.rows[0]);
      }

      try {
        const res = await pool.query(
          `UPDATE users SET ${updates.join(", ")}
           WHERE id = $1
           RETURNING id, name, email, role, team_id, created_at`,
          values
        );
        return reply.send(res.rows[0]);
      } catch (e: any) {
        if (String(e?.code) === "23505") {
          return reply.code(409).send({ message: "Email already exists" });
        }
        return reply.code(500).send({ message: "Error" });
      }
    }
  );

  server.delete(
    "/:id",
    { preHandler: [requireAuth, requireRole(["ADMIN"]) ] },
    async (request, reply) => {
      const u = request.authUser!;
      const id = (request.params as any).id as string;
      if (u.id === id) return reply.code(400).send({ message: "Cannot delete self" });
      try {
        const res = await pool.query("DELETE FROM users WHERE id = $1", [id]);
        if (res.rowCount === 0) return reply.code(404).send({ message: "Not found" });
        return reply.code(204).send();
      } catch {
        return reply.code(409).send({ message: "User is in use" });
      }
    }
  );
};
