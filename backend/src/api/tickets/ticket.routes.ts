import { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { requireAuth, requireRole } from "../../middlewares/auth.js";
import {
  createTicket,
  getAllTickets,
  getTicketDetailById,
  getTicketEvents,
  getTicketComments,
  createTicketComment,
  getTicketsForEmployee,
  updateTicketStatus,
  assignTicket,
  TicketStatus,
} from "../../services/tickets/ticket.service.js";

const createTicketSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().min(1).max(2000),
});

const statusSchema = z.object({
  status: z.enum(["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"]) as z.ZodType<TicketStatus>,
});

const assignSchema = z.object({
  assigned_team: z.string().uuid().nullable().optional(),
  assigned_agent: z.string().uuid().nullable().optional(),
});

const commentSchema = z.object({
  body: z.string().min(1).max(5000),
  is_internal: z.boolean().optional(),
});

export const ticketRoutes: FastifyPluginAsync = async (server) => {
  // POST /tickets (Employee)
  server.post("/", { preHandler: [requireAuth, requireRole(["EMPLOYEE"]) ] }, async (request, reply) => {
    const body = createTicketSchema.parse(request.body);
    const u = request.authUser!;

    const ticket = await createTicket({
      title: body.title,
      description: body.description,
      createdBy: u.id,
      performedBy: u.id,
    });

    return reply.code(201).send(ticket);
  });

  // GET /tickets/my (Employee)
  server.get("/my", { preHandler: [requireAuth, requireRole(["EMPLOYEE"]) ] }, async (request, reply) => {
    const u = request.authUser!;
    const tickets = await getTicketsForEmployee(u.id);
    return reply.send(tickets);
  });

  // GET /tickets (Admin/Agent)
  server.get("/", { preHandler: [requireAuth, requireRole(["ADMIN", "AGENT"]) ] }, async (_request, reply) => {
    const tickets = await getAllTickets();
    return reply.send(tickets);
  });

  // GET /tickets/:id (Employee: own, Admin/Agent: any)
  server.get("/:id", { preHandler: [requireAuth] }, async (request, reply) => {
    const u = request.authUser!;
    const id = (request.params as any).id as string;

    const ticket = await getTicketDetailById(id);
    if (!ticket) return reply.code(404).send({ message: "Not found" });

    if (u.role === "EMPLOYEE" && ticket.created_by !== u.id) {
      return reply.code(403).send({ message: "Forbidden" });
    }

    const events = await getTicketEvents(ticket.id);
    const now = Date.now();
    const firstResponseDueAt = ticket.sla_first_response_due_at ? new Date(ticket.sla_first_response_due_at).getTime() : null;
    const resolutionDueAt = ticket.sla_resolution_due_at ? new Date(ticket.sla_resolution_due_at).getTime() : null;

    const sla = {
      first_response_due_at: ticket.sla_first_response_due_at,
      resolution_due_at: ticket.sla_resolution_due_at,
      first_response_at: ticket.first_response_at,
      resolved_at: ticket.resolved_at,
      closed_at: ticket.closed_at,
      first_response_breached:
        !ticket.first_response_at && typeof firstResponseDueAt === "number" ? now > firstResponseDueAt : false,
      resolution_breached:
        ticket.status !== "CLOSED" && typeof resolutionDueAt === "number" ? now > resolutionDueAt : false,
    };

    return reply.send({ ticket, events, sla });
  });

  // GET /tickets/:id/comments (Employee: own, Admin/Agent: any)
  server.get("/:id/comments", { preHandler: [requireAuth] }, async (request, reply) => {
    const u = request.authUser!;
    const id = (request.params as any).id as string;

    const ticket = await getTicketDetailById(id);
    if (!ticket) return reply.code(404).send({ message: "Not found" });
    if (u.role === "EMPLOYEE" && ticket.created_by !== u.id) {
      return reply.code(403).send({ message: "Forbidden" });
    }

    const includeInternal = u.role !== "EMPLOYEE";
    const comments = await getTicketComments({ ticketId: ticket.id, includeInternal });
    return reply.send(comments);
  });

  // POST /tickets/:id/comments (Employee: own, Admin/Agent: any)
  server.post("/:id/comments", { preHandler: [requireAuth] }, async (request, reply) => {
    const u = request.authUser!;
    const id = (request.params as any).id as string;
    const body = commentSchema.parse(request.body);

    const ticket = await getTicketDetailById(id);
    if (!ticket) return reply.code(404).send({ message: "Not found" });
    if (u.role === "EMPLOYEE" && ticket.created_by !== u.id) {
      return reply.code(403).send({ message: "Forbidden" });
    }

    const isInternal = u.role === "EMPLOYEE" ? false : Boolean(body.is_internal);
    const created = await createTicketComment({
      ticketId: ticket.id,
      authorId: u.id,
      body: body.body,
      isInternal,
    });
    return reply.code(201).send(created);
  });

  // PATCH /tickets/:id/status (Admin/Agent)
  server.patch("/:id/status", { preHandler: [requireAuth, requireRole(["ADMIN", "AGENT"]) ] }, async (request, reply) => {
    const u = request.authUser!;
    const id = (request.params as any).id as string;
    const body = statusSchema.parse(request.body);

    try {
      const updated = await updateTicketStatus({
        ticketId: id,
        newStatus: body.status,
        performedBy: u.id,
      });
      return reply.send(updated);
    } catch (e: any) {
      return reply.code(e?.statusCode ?? 500).send({ message: e?.message ?? "Error" });
    }
  });

  // PATCH /tickets/:id/assign (Admin/Agent)
  server.patch("/:id/assign", { preHandler: [requireAuth, requireRole(["ADMIN", "AGENT"]) ] }, async (request, reply) => {
    const u = request.authUser!;
    const id = (request.params as any).id as string;
    const body = assignSchema.parse(request.body);

    const updated = await assignTicket({
      ticketId: id,
      assignedTeam: body.assigned_team ?? null,
      assignedAgent: body.assigned_agent ?? null,
      performedBy: u.id,
    });

    return reply.send(updated);
  });
};
