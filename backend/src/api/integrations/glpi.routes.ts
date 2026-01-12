import { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { requireAuth, requireRole } from "../../middlewares/auth.js";
import { pool } from "../../config/db.js";
import { syncGlpiTickets, syncTicketToGlpi } from "../../services/integrations/glpi-sync.service.js";

const createGlpiConfigSchema = z.object({
  name: z.string().min(1).max(100),
  api_url: z.string().url(),
  app_token: z.string().min(1),
  user_token: z.string().min(1),
  enabled: z.boolean().default(true),
  sync_interval_minutes: z.number().int().min(1).default(15),
});

export const glpiRoutes: FastifyPluginAsync = async (server) => {
  // GET /integrations/glpi/configs - List GLPI configurations
  server.get(
    "/integrations/glpi/configs",
    { preHandler: [requireAuth, requireRole(["ADMIN"])] },
    async (request, reply) => {
      const result = await pool.query(
        `SELECT id, name, api_url, enabled, sync_interval_minutes, last_sync_at, created_at
         FROM external_system_configs 
         WHERE system_type = 'GLPI'
         ORDER BY created_at DESC`
      );
      return reply.send(result.rows);
    }
  );

  // POST /integrations/glpi/configs - Create GLPI configuration
  server.post(
    "/integrations/glpi/configs",
    { preHandler: [requireAuth, requireRole(["ADMIN"])] },
    async (request, reply) => {
      const body = createGlpiConfigSchema.parse(request.body);

      const result = await pool.query(
        `INSERT INTO external_system_configs 
         (system_type, name, api_url, app_token, user_token, enabled, sync_interval_minutes)
         VALUES ('GLPI', $1, $2, $3, $4, $5, $6)
         RETURNING id, name, api_url, enabled, sync_interval_minutes, created_at`,
        [
          body.name,
          body.api_url,
          body.app_token,
          body.user_token,
          body.enabled,
          body.sync_interval_minutes,
        ]
      );

      return reply.code(201).send(result.rows[0]);
    }
  );

  // POST /integrations/glpi/sync/:configId - Manually sync GLPI tickets
  server.post(
    "/integrations/glpi/sync/:configId",
    { preHandler: [requireAuth, requireRole(["ADMIN"])] },
    async (request, reply) => {
      const params = z.object({ configId: z.string().uuid() }).parse(request.params);

      try {
        const result = await syncGlpiTickets(params.configId);
        return reply.send(result);
      } catch (err: any) {
        return reply.code(500).send({ message: err.message || "Sync failed" });
      }
    }
  );

  // POST /integrations/glpi/sync-ticket/:ticketId - Sync specific ticket to GLPI
  server.post(
    "/integrations/glpi/sync-ticket/:ticketId",
    { preHandler: [requireAuth, requireRole(["ADMIN", "AGENT"])] },
    async (request, reply) => {
      const params = z.object({ ticketId: z.string().uuid() }).parse(request.params);
      const body = z.object({ configId: z.string().uuid() }).parse(request.body);

      try {
        await syncTicketToGlpi(params.ticketId, body.configId);
        return reply.send({ message: "Ticket synced to GLPI" });
      } catch (err: any) {
        return reply.code(500).send({ message: err.message || "Sync failed" });
      }
    }
  );
};
