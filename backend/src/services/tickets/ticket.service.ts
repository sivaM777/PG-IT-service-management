import { pool } from "../../config/db.js";
import { env } from "../../config/env.js";
import nodemailer from "nodemailer";

export type TicketPriority = "LOW" | "MEDIUM" | "HIGH";
export type TicketStatus = "OPEN" | "IN_PROGRESS" | "RESOLVED" | "CLOSED";
export type TicketEventAction = "CREATED" | "STATUS_CHANGED" | "ASSIGNED" | "CLOSED";

export interface TicketRow {
  id: string;
  title: string;
  description: string;
  created_by: string;
  category: string | null;
  priority: TicketPriority;
  status: TicketStatus;
  assigned_team: string | null;
  assigned_agent: string | null;
  ai_confidence: number | null;
  sla_first_response_due_at: string | null;
  sla_resolution_due_at: string | null;
  first_response_at: string | null;
  resolved_at: string | null;
  closed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface TicketListRow extends TicketRow {
  requester_name: string;
  requester_email: string;
  assigned_team_name: string | null;
  assigned_agent_name: string | null;
  assigned_agent_email: string | null;
}

export interface TicketCommentRow {
  id: string;
  ticket_id: string;
  author_id: string;
  author_name: string;
  author_email: string;
  body: string;
  is_internal: boolean;
  created_at: string;
}

type TicketNotificationTargets = {
  ticket_id: string;
  title: string;
  status: TicketStatus;
  priority: TicketPriority;
  requester_id: string;
  requester_email: string;
  requester_name: string;
  assigned_agent_id: string | null;
  assigned_agent_email: string | null;
  assigned_agent_name: string | null;
};

const allowedTransitions: Record<TicketStatus, TicketStatus[]> = {
  OPEN: ["IN_PROGRESS", "RESOLVED"],
  IN_PROGRESS: ["RESOLVED"],
  RESOLVED: ["CLOSED"],
  CLOSED: [],
};

export const assertTransitionAllowed = (from: TicketStatus, to: TicketStatus) => {
  const allowed = allowedTransitions[from] || [];
  if (!allowed.includes(to)) {
    const msg = `Illegal transition: ${from} -> ${to}`;
    const err = new Error(msg);
    (err as any).statusCode = 400;
    throw err;
  }
};

const getNotificationTargets = async (ticketId: string): Promise<TicketNotificationTargets | null> => {
  const res = await pool.query<TicketNotificationTargets>(
    `SELECT
      t.id AS ticket_id,
      t.title,
      t.status,
      t.priority,
      u.id AS requester_id,
      u.email AS requester_email,
      u.name AS requester_name,
      au.id AS assigned_agent_id,
      au.email AS assigned_agent_email,
      au.name AS assigned_agent_name
    FROM tickets t
    JOIN users u ON u.id = t.created_by
    LEFT JOIN users au ON au.id = t.assigned_agent
    WHERE t.id = $1`,
    [ticketId]
  );
  return res.rows[0] ?? null;
};

type NotificationType = "TICKET_CREATED" | "TICKET_ASSIGNED" | "TICKET_STATUS_CHANGED";

const insertNotification = async (args: {
  userId: string;
  ticketId: string | null;
  type: NotificationType;
  title: string;
  body: string;
}) => {
  await pool.query(
    `INSERT INTO notifications (user_id, ticket_id, type, title, body)
     VALUES ($1, $2, $3, $4, $5)`,
    [args.userId, args.ticketId, args.type, args.title, args.body]
  );
};

export const sendMail = async (args: { to: string; subject: string; text: string }) => {
  const host = env.SMTP_HOST;
  const port = env.SMTP_PORT;
  const from = env.SMTP_FROM;
  if (!host || !port || !from) return;

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth:
      env.SMTP_USERNAME && env.SMTP_PASSWORD
        ? { user: env.SMTP_USERNAME, pass: env.SMTP_PASSWORD }
        : undefined,
  });

  await transporter.sendMail({
    from,
    to: args.to,
    subject: args.subject,
    text: args.text,
  });
};

const notifyTicketCreated = async (ticketId: string) => {
  try {
    const t = await getNotificationTargets(ticketId);
    if (!t) return;

    // Use alert rules system if available
    try {
      const { processAlerts } = await import("../alerts/alert-rules.service.js");
      await processAlerts({
        ticketId: t.ticket_id,
        title: t.title,
        description: "", // Will be fetched if needed
        category: null,
        priority: t.priority,
        status: t.status,
        assignedTeam: null,
        assignedAgent: null,
        requesterEmail: t.requester_email,
        requesterName: t.requester_name,
        eventType: "TICKET_CREATED",
      });
    } catch {
      // Fallback to legacy notification
      await insertNotification({
        userId: t.requester_id,
        ticketId: t.ticket_id,
        type: "TICKET_CREATED",
        title: "Ticket created",
        body: `${t.title} (${t.priority})`,
      });

      await sendMail({
        to: t.requester_email,
        subject: `[TICKET-${t.ticket_id}] Ticket created: ${t.title}`,
        text: `Your ticket has been created.\n\nID: ${t.ticket_id}\nStatus: ${t.status}\nPriority: ${t.priority}\n`,
      });
    }
  } catch {
    return;
  }
};

const notifyTicketAssigned = async (ticketId: string) => {
  try {
    const t = await getNotificationTargets(ticketId);
    if (!t) return;

    // Use alert rules system
    try {
      const { processAlerts } = await import("../alerts/alert-rules.service.js");
      await processAlerts({
        ticketId: t.ticket_id,
        title: t.title,
        description: "",
        category: null,
        priority: t.priority,
        status: t.status,
        assignedTeam: null,
        assignedAgent: t.assigned_agent_id || null,
        requesterEmail: t.requester_email,
        requesterName: t.requester_name,
        eventType: "TICKET_ASSIGNED",
      });
    } catch {
      // Fallback
      if (t.assigned_agent_email && t.assigned_agent_id) {
        await insertNotification({
          userId: t.assigned_agent_id,
          ticketId: t.ticket_id,
          type: "TICKET_ASSIGNED",
          title: "Ticket assigned to you",
          body: `${t.title} (${t.priority})`,
        });

        await sendMail({
          to: t.assigned_agent_email,
          subject: `[TICKET-${t.ticket_id}] Ticket assigned: ${t.title}`,
          text: `A ticket has been assigned to you.\n\nID: ${t.ticket_id}\nStatus: ${t.status}\nPriority: ${t.priority}\nRequester: ${t.requester_name} <${t.requester_email}>\n`,
        });
      }
    }
  } catch {
    return;
  }
};

const notifyTicketStatusChanged = async (ticketId: string) => {
  try {
    const t = await getNotificationTargets(ticketId);
    if (!t) return;

    // Use alert rules system
    try {
      const { processAlerts } = await import("../alerts/alert-rules.service.js");
      const eventType = t.status === "RESOLVED" ? "TICKET_RESOLVED" : 
                       t.status === "CLOSED" ? "TICKET_CLOSED" : 
                       "TICKET_STATUS_CHANGED";
      
      await processAlerts({
        ticketId: t.ticket_id,
        title: t.title,
        description: "",
        category: null,
        priority: t.priority,
        status: t.status,
        assignedTeam: null,
        assignedAgent: t.assigned_agent_id || null,
        requesterEmail: t.requester_email,
        requesterName: t.requester_name,
        eventType,
      });
    } catch {
      // Fallback
      await insertNotification({
        userId: t.requester_id,
        ticketId: t.ticket_id,
        type: "TICKET_STATUS_CHANGED",
        title: "Ticket status updated",
        body: `${t.title} → ${t.status}`,
      });

      if (t.assigned_agent_id) {
        await insertNotification({
          userId: t.assigned_agent_id,
          ticketId: t.ticket_id,
          type: "TICKET_STATUS_CHANGED",
          title: "Ticket status updated",
          body: `${t.title} → ${t.status}`,
        });
      }

      await sendMail({
        to: t.requester_email,
        subject: `[TICKET-${t.ticket_id}] Ticket update: ${t.title} (${t.status})`,
        text: `Your ticket status has been updated.\n\nID: ${t.ticket_id}\nStatus: ${t.status}\nPriority: ${t.priority}\n`,
      });
    }
  } catch {
    return;
  }
};

const computeSlaDueDates = (priority: TicketPriority, createdAt: Date) => {
  const firstResponseMs =
    priority === "HIGH"
      ? 4 * 60 * 60 * 1000
      : priority === "MEDIUM"
        ? 8 * 60 * 60 * 1000
        : 24 * 60 * 60 * 1000;

  const resolutionMs =
    priority === "HIGH"
      ? 24 * 60 * 60 * 1000
      : priority === "MEDIUM"
        ? 72 * 60 * 60 * 1000
        : 5 * 24 * 60 * 60 * 1000;

  return {
    firstResponseDueAt: new Date(createdAt.getTime() + firstResponseMs),
    resolutionDueAt: new Date(createdAt.getTime() + resolutionMs),
  };
};

export const createTicket = async (args: {
  title: string;
  description: string;
  createdBy: string;
  performedBy: string;
  sourceType?: "WEB" | "MOBILE" | "EMAIL" | "GLPI" | "SOLMAN" | "CHATBOT";
  sourceReference?: Record<string, any>;
  integrationMetadata?: Record<string, any>;
}): Promise<TicketRow> => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const sourceType = args.sourceType || "WEB";
    const sourceRef = args.sourceReference ? JSON.stringify(args.sourceReference) : null;
    const integrationMeta = args.integrationMetadata ? JSON.stringify(args.integrationMetadata) : null;

    const inserted = await client.query<TicketRow>(
      `INSERT INTO tickets (title, description, created_by, source_type, source_reference, integration_metadata)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [args.title, args.description, args.createdBy, sourceType, sourceRef, integrationMeta]
    );

    const baseTicket = inserted.rows[0]!;

    const { firstResponseDueAt, resolutionDueAt } = computeSlaDueDates(
      baseTicket.priority,
      new Date(baseTicket.created_at)
    );

    const slaUpdatedRes = await client.query<TicketRow>(
      `UPDATE tickets
       SET sla_first_response_due_at = $2,
           sla_resolution_due_at = $3
       WHERE id = $1
       RETURNING *`,
      [baseTicket.id, firstResponseDueAt.toISOString(), resolutionDueAt.toISOString()]
    );

    const ticket = slaUpdatedRes.rows[0] ?? baseTicket;

    await client.query(
      `INSERT INTO ticket_events (ticket_id, action, old_value, new_value, performed_by)
       VALUES ($1, $2, $3::jsonb, $4::jsonb, $5)`,
      [
        ticket.id,
        "CREATED",
        null,
        JSON.stringify({ title: ticket.title, status: ticket.status }),
        args.performedBy,
      ]
    );

    await client.query("COMMIT");

    void notifyTicketCreated(ticket.id);

    // Step 1: AI Classification (must happen before routing)
    let classifiedTicket = ticket;
    let aiIntent: string | undefined;
    let aiKeywords: string[] | undefined;
    try {
      if (env.AI_CLASSIFIER_URL) {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 2000);

        const text = `${args.title} ${args.description}`;

        const base = env.AI_CLASSIFIER_URL.replace(/\/$/, "");
        const enrichUrl = base.endsWith("/predict")
          ? `${base.slice(0, -"/predict".length)}/enrich`
          : `${base}/enrich`;

        const res = await fetch(enrichUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text }),
          signal: controller.signal,
        }).finally(() => clearTimeout(timeout));

        if (res.ok) {
          const data: any = await res.json().catch(() => null);
          const category = typeof data?.category === "string" ? data.category : null;
          const confidence = typeof data?.confidence === "number" ? data.confidence : null;

          aiIntent = typeof data?.intent === "string" ? data.intent : undefined;
          aiKeywords = Array.isArray(data?.keywords)
            ? data.keywords.filter((k: any) => typeof k === "string")
            : undefined;

          const suggestedPriority: TicketPriority | null =
            data?.priority === "LOW" || data?.priority === "MEDIUM" || data?.priority === "HIGH"
              ? data.priority
              : null;

          const nextPriority = suggestedPriority ?? classifiedTicket.priority;
          const { firstResponseDueAt, resolutionDueAt } = computeSlaDueDates(
            nextPriority,
            new Date(classifiedTicket.created_at)
          );

          const aiMeta = {
            summary: typeof data?.summary === "string" ? data.summary : undefined,
            intent: aiIntent,
            keywords: aiKeywords,
            entities: typeof data?.entities === "object" && data?.entities ? data.entities : undefined,
            priority_suggestion: suggestedPriority,
            auto_resolvable: typeof data?.auto_resolvable === "boolean" ? data.auto_resolvable : undefined,
            suggested_workflow:
              typeof data?.suggested_workflow === "string" ? data.suggested_workflow : undefined,
            approval_title: typeof data?.approval_title === "string" ? data.approval_title : undefined,
            approval_body: typeof data?.approval_body === "string" ? data.approval_body : undefined,
            model_confidence: confidence,
          };

          const updatedRes = await pool.query<TicketRow>(
            `UPDATE tickets
             SET category = COALESCE($2, category),
                 ai_confidence = COALESCE($3, ai_confidence),
                 priority = $4,
                 sla_first_response_due_at = $5,
                 sla_resolution_due_at = $6,
                 integration_metadata = jsonb_set(COALESCE(integration_metadata, '{}'::jsonb), '{ai}', $7::jsonb, true)
             WHERE id = $1
             RETURNING *`,
            [
              ticket.id,
              category,
              confidence,
              nextPriority,
              firstResponseDueAt.toISOString(),
              resolutionDueAt.toISOString(),
              JSON.stringify(aiMeta),
            ]
          );
          if (updatedRes.rows.length > 0) {
            classifiedTicket = updatedRes.rows[0];
          }
        }
      }
    } catch (aiErr) {
      // Log but don't fail ticket creation
      console.error("AI classification error:", aiErr);
    }

    // Step 1.5: Auto-resolution workflows (optional). If it resolves the ticket, skip routing.
    try {
      const { findMatchingWorkflows, executeWorkflow } = await import(
        "../workflows/auto-resolution.service.js"
      );

      const matching = await findMatchingWorkflows({
        intent: aiIntent,
        category: classifiedTicket.category,
        keywords: aiKeywords,
        description: classifiedTicket.description,
      });

      if (matching.length > 0) {
        const execution = await executeWorkflow(
          matching[0],
          {
            ticketId: classifiedTicket.id,
            title: classifiedTicket.title,
            description: classifiedTicket.description,
            intent: aiIntent,
            keywords: aiKeywords,
            category: classifiedTicket.category,
            priority: classifiedTicket.priority,
          },
          classifiedTicket.id
        );

        const afterWorkflow = await pool.query<TicketRow>(
          "SELECT * FROM tickets WHERE id = $1",
          [classifiedTicket.id]
        );
        if (afterWorkflow.rows[0]) {
          classifiedTicket = afterWorkflow.rows[0];
          if (classifiedTicket.status === "RESOLVED" || classifiedTicket.status === "CLOSED") {
            return classifiedTicket;
          }
        }

        if (execution.status === "pending") {
          return classifiedTicket;
        }
      }
    } catch (workflowErr) {
      console.error("Workflow auto-resolution error:", workflowErr);
    }

    // Step 2: Apply intelligent routing after AI classification
    try {
      const { routeTicket, applyRouting } = await import("../routing/intelligent-routing.service.js");
      const routingResult = await routeTicket({
        ticketId: classifiedTicket.id,
        category: classifiedTicket.category,
        priority: classifiedTicket.priority,
        title: classifiedTicket.title,
        description: classifiedTicket.description,
      });

      if (routingResult.priority !== classifiedTicket.priority) {
        const { firstResponseDueAt, resolutionDueAt } = computeSlaDueDates(
          routingResult.priority,
          new Date(classifiedTicket.created_at)
        );
        const priUpdated = await pool.query<TicketRow>(
          `UPDATE tickets
           SET priority = $2,
               sla_first_response_due_at = $3,
               sla_resolution_due_at = $4
           WHERE id = $1
           RETURNING *`,
          [
            classifiedTicket.id,
            routingResult.priority,
            firstResponseDueAt.toISOString(),
            resolutionDueAt.toISOString(),
          ]
        );
        if (priUpdated.rows[0]) {
          classifiedTicket = priUpdated.rows[0];
        }
      }

      // Apply routing if confidence is sufficient
      if (routingResult.confidence >= 0.6) {
        await applyRouting(classifiedTicket.id, routingResult, args.performedBy);
        
        // Reload ticket to get updated assignment
        const updatedRes = await pool.query<TicketRow>("SELECT * FROM tickets WHERE id = $1", [classifiedTicket.id]);
        if (updatedRes.rows.length > 0) {
          return updatedRes.rows[0];
        }
      }
    } catch (routingErr) {
      // Log but don't fail ticket creation
      console.error("Routing error:", routingErr);
    }

    return classifiedTicket;
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
};

export const getTicketById = async (id: string): Promise<TicketRow | null> => {
  const res = await pool.query<TicketRow>("SELECT * FROM tickets WHERE id = $1", [id]);
  return res.rows[0] ?? null;
};

export const getTicketDetailById = async (id: string): Promise<TicketListRow | null> => {
  const res = await pool.query<TicketListRow>(
    `SELECT
      t.*, 
      u.name AS requester_name,
      u.email AS requester_email,
      tm.name AS assigned_team_name,
      au.name AS assigned_agent_name,
      au.email AS assigned_agent_email
    FROM tickets t
    JOIN users u ON u.id = t.created_by
    LEFT JOIN teams tm ON tm.id = t.assigned_team
    LEFT JOIN users au ON au.id = t.assigned_agent
    WHERE t.id = $1`,
    [id]
  );
  return res.rows[0] ?? null;
};

export const getTicketsForEmployee = async (userId: string): Promise<TicketListRow[]> => {
  const res = await pool.query<TicketListRow>(
    `SELECT
      t.*, 
      u.name AS requester_name,
      u.email AS requester_email,
      tm.name AS assigned_team_name,
      au.name AS assigned_agent_name,
      au.email AS assigned_agent_email
    FROM tickets t
    JOIN users u ON u.id = t.created_by
    LEFT JOIN teams tm ON tm.id = t.assigned_team
    LEFT JOIN users au ON au.id = t.assigned_agent
    WHERE t.created_by = $1
    ORDER BY t.updated_at DESC`,
    [userId]
  );
  return res.rows;
};

export const getAllTickets = async (): Promise<TicketListRow[]> => {
  const res = await pool.query<TicketListRow>(
    `SELECT
      t.*, 
      u.name AS requester_name,
      u.email AS requester_email,
      tm.name AS assigned_team_name,
      au.name AS assigned_agent_name,
      au.email AS assigned_agent_email
    FROM tickets t
    JOIN users u ON u.id = t.created_by
    LEFT JOIN teams tm ON tm.id = t.assigned_team
    LEFT JOIN users au ON au.id = t.assigned_agent
    ORDER BY t.updated_at DESC`
  );
  return res.rows;
};

export const getTicketEvents = async (ticketId: string) => {
  const res = await pool.query(
    "SELECT id, ticket_id, action, old_value, new_value, performed_by, timestamp FROM ticket_events WHERE ticket_id = $1 ORDER BY timestamp ASC",
    [ticketId]
  );
  return res.rows;
};

export const getTicketComments = async (args: { ticketId: string; includeInternal: boolean }) => {
  const res = await pool.query<TicketCommentRow>(
    `SELECT
      c.id,
      c.ticket_id,
      c.author_id,
      u.name AS author_name,
      u.email AS author_email,
      c.body,
      c.is_internal,
      c.created_at
    FROM ticket_comments c
    JOIN users u ON u.id = c.author_id
    WHERE c.ticket_id = $1
      AND ($2::boolean = true OR c.is_internal = false)
    ORDER BY c.created_at ASC`,
    [args.ticketId, args.includeInternal]
  );
  return res.rows;
};

export const createTicketComment = async (args: {
  ticketId: string;
  authorId: string;
  body: string;
  isInternal: boolean;
}): Promise<TicketCommentRow> => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const inserted = await client.query<TicketCommentRow>(
      `INSERT INTO ticket_comments (ticket_id, author_id, body, is_internal)
       VALUES ($1, $2, $3, $4)
       RETURNING id, ticket_id, author_id, body, is_internal, created_at`,
      [args.ticketId, args.authorId, args.body, args.isInternal]
    );

    // Update ticket updated_at so lists reorder and detail shows fresh timestamp
    await client.query("UPDATE tickets SET updated_at = now() WHERE id = $1", [args.ticketId]);

    const withAuthor = await client.query<TicketCommentRow>(
      `SELECT
        c.id,
        c.ticket_id,
        c.author_id,
        u.name AS author_name,
        u.email AS author_email,
        c.body,
        c.is_internal,
        c.created_at
      FROM ticket_comments c
      JOIN users u ON u.id = c.author_id
      WHERE c.id = $1`,
      [inserted.rows[0]!.id]
    );

    await client.query("COMMIT");
    return withAuthor.rows[0]!;
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
};

export const updateTicketStatus = async (args: {
  ticketId: string;
  newStatus: TicketStatus;
  performedBy: string;
}): Promise<TicketRow> => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const currentRes = await client.query<TicketRow>("SELECT * FROM tickets WHERE id = $1", [args.ticketId]);
    const current = currentRes.rows[0];
    if (!current) {
      const err = new Error("Ticket not found");
      (err as any).statusCode = 404;
      throw err;
    }

    assertTransitionAllowed(current.status, args.newStatus);

    const updatedRes = await client.query<TicketRow>(
      `UPDATE tickets
       SET status = $2,
           first_response_at = CASE
             WHEN $2 = 'IN_PROGRESS' THEN COALESCE(first_response_at, now())
             ELSE first_response_at
           END,
           resolved_at = CASE
             WHEN $2 = 'RESOLVED' THEN COALESCE(resolved_at, now())
             ELSE resolved_at
           END,
           closed_at = CASE
             WHEN $2 = 'CLOSED' THEN COALESCE(closed_at, now())
             ELSE closed_at
           END
       WHERE id = $1
       RETURNING *`,
      [args.ticketId, args.newStatus]
    );
    const updated = updatedRes.rows[0]!;

    const action: TicketEventAction = args.newStatus === "CLOSED" ? "CLOSED" : "STATUS_CHANGED";

    await client.query(
      `INSERT INTO ticket_events (ticket_id, action, old_value, new_value, performed_by)
       VALUES ($1, $2, $3::jsonb, $4::jsonb, $5)`,
      [
        updated.id,
        action,
        JSON.stringify({ status: current.status }),
        JSON.stringify({ status: updated.status }),
        args.performedBy,
      ]
    );

    await client.query("COMMIT");
    void notifyTicketStatusChanged(updated.id);
    return updated;
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
};

export const assignTicket = async (args: {
  ticketId: string;
  assignedTeam: string | null;
  assignedAgent: string | null;
  performedBy: string;
}): Promise<TicketRow> => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const currentRes = await client.query<TicketRow>("SELECT * FROM tickets WHERE id = $1", [args.ticketId]);
    const current = currentRes.rows[0];
    if (!current) {
      const err = new Error("Ticket not found");
      (err as any).statusCode = 404;
      throw err;
    }

    const updatedRes = await client.query<TicketRow>(
      "UPDATE tickets SET assigned_team = $2, assigned_agent = $3 WHERE id = $1 RETURNING *",
      [args.ticketId, args.assignedTeam, args.assignedAgent]
    );
    const updated = updatedRes.rows[0]!;

    await client.query(
      `INSERT INTO ticket_events (ticket_id, action, old_value, new_value, performed_by)
       VALUES ($1, $2, $3::jsonb, $4::jsonb, $5)`,
      [
        updated.id,
        "ASSIGNED",
        JSON.stringify({ assigned_team: current.assigned_team, assigned_agent: current.assigned_agent }),
        JSON.stringify({ assigned_team: updated.assigned_team, assigned_agent: updated.assigned_agent }),
        args.performedBy,
      ]
    );

    await client.query("COMMIT");
    if (updated.assigned_agent) {
      void notifyTicketAssigned(updated.id);
    }
    return updated;
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
};
