import { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { pool } from "../../config/db.js";
import { env } from "../../config/env.js";
import { requireAuth } from "../../middlewares/auth.js";
import {
  decideApproval,
  getApprovalByToken,
  getPendingApprovalForTicket,
} from "../../services/approvals/approval.service.js";

type TicketOwnerRow = {
  created_by: string;
};

export const approvalRoutes: FastifyPluginAsync = async (server) => {
  server.get(
    "/approvals/tickets/:ticketId/pending",
    { preHandler: [requireAuth] },
    async (request, reply) => {
      const u = request.authUser!;
      const params = z.object({ ticketId: z.string().uuid() }).parse(request.params);

      const ownerRes = await pool.query<TicketOwnerRow>(
        "SELECT created_by FROM tickets WHERE id = $1",
        [params.ticketId]
      );
      const owner = ownerRes.rows[0];
      if (!owner) return reply.code(404).send({ message: "Ticket not found" });

      if (u.role === "EMPLOYEE" && owner.created_by !== u.id) {
        return reply.code(403).send({ message: "Forbidden" });
      }

      const pending = await getPendingApprovalForTicket(params.ticketId);
      return reply.send({ approval: pending });
    }
  );

  server.post(
    "/approvals/:id/approve",
    { preHandler: [requireAuth] },
    async (request, reply) => {
      const u = request.authUser!;
      const params = z.object({ id: z.string().uuid() }).parse(request.params);

      const current = await pool.query(
        "SELECT * FROM approval_requests WHERE id = $1",
        [params.id]
      );
      const reqRow: any = current.rows[0];
      if (!reqRow) return reply.code(404).send({ message: "Not found" });

      if (u.role === "EMPLOYEE" && reqRow.requested_by !== u.id) {
        return reply.code(403).send({ message: "Forbidden" });
      }

      const decided = await decideApproval({ approvalId: params.id, decision: "approved" });

      const workflowRes = await pool.query("SELECT * FROM workflows WHERE id = $1", [decided.workflow_id]);
      const workflow = workflowRes.rows[0];
      if (!workflow) return reply.code(404).send({ message: "Workflow not found" });

      const { executeWorkflow } = await import("../../services/workflows/auto-resolution.service.js");
      const execution = await executeWorkflow(
        workflow,
        { ...(decided.input_data || {}), approved: true },
        decided.ticket_id
      );

      return reply.send({ ok: true, approval: decided, execution });
    }
  );

  server.post(
    "/approvals/:id/reject",
    { preHandler: [requireAuth] },
    async (request, reply) => {
      const u = request.authUser!;
      const params = z.object({ id: z.string().uuid() }).parse(request.params);

      const current = await pool.query(
        "SELECT * FROM approval_requests WHERE id = $1",
        [params.id]
      );
      const reqRow: any = current.rows[0];
      if (!reqRow) return reply.code(404).send({ message: "Not found" });

      if (u.role === "EMPLOYEE" && reqRow.requested_by !== u.id) {
        return reply.code(403).send({ message: "Forbidden" });
      }

      const decided = await decideApproval({ approvalId: params.id, decision: "rejected" });

      const { routeTicket, applyRouting } = await import("../../services/routing/intelligent-routing.service.js");
      const tRes = await pool.query("SELECT * FROM tickets WHERE id = $1", [decided.ticket_id]);
      const t = tRes.rows[0];
      if (t) {
        const routing = await routeTicket({
          ticketId: t.id,
          category: t.category,
          priority: t.priority,
          title: t.title,
          description: t.description,
        });

        if (routing.confidence >= 0.6) {
          await applyRouting(t.id, routing, decided.requested_by);
        }
      }

      return reply.send({ ok: true, approval: decided });
    }
  );

  server.get("/approvals/confirm/:token", async (request, reply) => {
    const params = z.object({ token: z.string().min(10) }).parse(request.params);
    const query = z
      .object({
        decision: z.enum(["approve", "reject"]),
      })
      .parse(request.query);

    const approval = await getApprovalByToken(params.token);
    if (!approval) return reply.code(404).send({ message: "Not found" });

    if (approval.status !== "pending") {
      const webUrl = env.PUBLIC_WEB_URL || "http://localhost:3000";
      return reply.redirect(`${webUrl}/app/tickets/${approval.ticket_id}`);
    }

    const decision = query.decision === "approve" ? "approved" : "rejected";
    const decided = await decideApproval({ approvalId: approval.id, decision });

    if (decision === "approved") {
      const workflowRes = await pool.query("SELECT * FROM workflows WHERE id = $1", [decided.workflow_id]);
      const workflow = workflowRes.rows[0];
      if (workflow) {
        const { executeWorkflow } = await import("../../services/workflows/auto-resolution.service.js");
        await executeWorkflow(workflow, { ...(decided.input_data || {}), approved: true }, decided.ticket_id);
      }
    } else {
      const { routeTicket, applyRouting } = await import("../../services/routing/intelligent-routing.service.js");
      const tRes = await pool.query("SELECT * FROM tickets WHERE id = $1", [decided.ticket_id]);
      const t = tRes.rows[0];
      if (t) {
        const routing = await routeTicket({
          ticketId: t.id,
          category: t.category,
          priority: t.priority,
          title: t.title,
          description: t.description,
        });
        if (routing.confidence >= 0.6) {
          await applyRouting(t.id, routing, decided.requested_by);
        }
      }
    }

    const webUrl = env.PUBLIC_WEB_URL || "http://localhost:3000";
    return reply.redirect(`${webUrl}/app/tickets/${decided.ticket_id}?approval=${decision}`);
  });
};
