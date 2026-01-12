import { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { requireAuth, requireRole } from "../../middlewares/auth.js";
import { pool } from "../../config/db.js";
import { analyzeTicketTrends, getKbSuggestionsForTicket } from "../../services/kb/kb-trend.service.js";

export const kbTrendRoutes: FastifyPluginAsync = async (server) => {
  // GET /kb/trends - Get KB trend analysis
  server.get(
    "/kb/trends",
    { preHandler: [requireAuth, requireRole(["ADMIN"])] },
    async (request, reply) => {
      const query = z
        .object({
          limit: z.coerce.number().int().min(1).max(50).default(10),
        })
        .parse(request.query);

      const trends = await analyzeTicketTrends(query.limit);
      return reply.send(trends);
    }
  );

  // GET /kb/suggestions/:ticketId - Get KB suggestions for a ticket
  server.get(
    "/kb/suggestions/:ticketId",
    { preHandler: [requireAuth] },
    async (request, reply) => {
      const params = z.object({ ticketId: z.string().uuid() }).parse(request.params);
      const suggestions = await getKbSuggestionsForTicket(params.ticketId);
      return reply.send(suggestions);
    }
  );

  // POST /kb/suggestions/:id/approve - Approve and create KB article from suggestion
  server.post(
    "/kb/suggestions/:id/approve",
    { preHandler: [requireAuth, requireRole(["ADMIN"])] },
    async (request, reply) => {
      const params = z.object({ id: z.string().uuid() }).parse(request.params);
      const u = request.authUser!;

      // Get suggestion
      const suggestionResult = await pool.query(
        "SELECT * FROM kb_suggestions WHERE id = $1 AND status = 'pending'",
        [params.id]
      );

      if (suggestionResult.rows.length === 0) {
        return reply.code(404).send({ message: "Suggestion not found or already processed" });
      }

      const suggestion = suggestionResult.rows[0];

      // Create KB article
      const articleResult = await pool.query(
        `INSERT INTO kb_articles (title, body, category, tags)
         VALUES ($1, $2, $3, $4)
         RETURNING id`,
        [
          suggestion.suggested_title,
          suggestion.suggested_body,
          null, // Category could be inferred
          [], // Tags could be extracted
        ]
      );

      const articleId = articleResult.rows[0].id;

      // Update suggestion status
      await pool.query(
        `UPDATE kb_suggestions 
         SET status = 'approved', 
             created_article_id = $1,
             reviewed_at = now(),
             reviewed_by = $2
         WHERE id = $3`,
        [articleId, u.id, params.id]
      );

      return reply.send({ articleId, message: "KB article created from suggestion" });
    }
  );

  // POST /kb/articles/:id/track-view - Track KB article view
  server.post(
    "/kb/articles/:id/track-view",
    { preHandler: [requireAuth] },
    async (request, reply) => {
      const params = z.object({ id: z.string().uuid() }).parse(request.params);

      await pool.query("SELECT track_kb_article_view($1)", [params.id]);

      return reply.send({ message: "View tracked" });
    }
  );

  // POST /kb/articles/:id/track-helpful - Track KB article helpfulness
  server.post(
    "/kb/articles/:id/track-helpful",
    { preHandler: [requireAuth] },
    async (request, reply) => {
      const params = z.object({ id: z.string().uuid() }).parse(request.params);

      await pool.query("SELECT track_kb_article_helpful($1)", [params.id]);

      return reply.send({ message: "Helpfulness tracked" });
    }
  );
};
