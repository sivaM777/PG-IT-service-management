import { randomBytes, createHash } from "crypto";
import { pool } from "../../config/db.js";
import { env } from "../../config/env.js";
import nodemailer from "nodemailer";

export type ApprovalStatus = "pending" | "approved" | "rejected" | "expired";

export type ApprovalRequestRow = {
  id: string;
  ticket_id: string;
  workflow_id: string;
  workflow_execution_id: string | null;
  step_index: number;
  requested_by: string;
  status: ApprovalStatus;
  action_title: string;
  action_body: string;
  input_data: any;
  token_hash: string;
  expires_at: string | null;
  decided_at: string | null;
  created_at: string;
};

function sha256Hex(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

async function sendMail(args: { to: string; subject: string; text: string }) {
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
}

function getPublicWebUrl(): string {
  return env.PUBLIC_WEB_URL || "http://localhost:3000";
}

function getPublicApiUrl(): string {
  if (env.PUBLIC_API_URL) return env.PUBLIC_API_URL;
  return `http://localhost:${env.PORT}`;
}

export async function createApprovalRequest(args: {
  ticketId: string;
  workflowId: string;
  workflowExecutionId: string | null;
  stepIndex: number;
  actionTitle: string;
  actionBody: string;
  inputData: Record<string, any>;
  expiresInHours?: number;
}): Promise<{ request: ApprovalRequestRow; token: string }> {
  const ticketRes = await pool.query<{ created_by: string; title: string }>(
    "SELECT created_by, title FROM tickets WHERE id = $1",
    [args.ticketId]
  );
  const ticket = ticketRes.rows[0];
  if (!ticket) {
    const err = new Error("Ticket not found");
    (err as any).statusCode = 404;
    throw err;
  }

  const userRes = await pool.query<{ id: string; email: string; name: string }>(
    "SELECT id, email, name FROM users WHERE id = $1",
    [ticket.created_by]
  );
  const user = userRes.rows[0];
  if (!user) {
    const err = new Error("Requester not found");
    (err as any).statusCode = 404;
    throw err;
  }

  const token = randomBytes(24).toString("hex");
  const tokenHash = sha256Hex(token);
  const expiresAt = args.expiresInHours
    ? new Date(Date.now() + args.expiresInHours * 60 * 60 * 1000)
    : null;

  const inserted = await pool.query<ApprovalRequestRow>(
    `INSERT INTO approval_requests
     (ticket_id, workflow_id, workflow_execution_id, step_index, requested_by, status, action_title, action_body, input_data, token_hash, expires_at)
     VALUES ($1, $2, $3, $4, $5, 'pending', $6, $7, $8::jsonb, $9, $10)
     RETURNING *`,
    [
      args.ticketId,
      args.workflowId,
      args.workflowExecutionId,
      args.stepIndex,
      user.id,
      args.actionTitle,
      args.actionBody,
      JSON.stringify(args.inputData || {}),
      tokenHash,
      expiresAt ? expiresAt.toISOString() : null,
    ]
  );

  const request = inserted.rows[0];

  await pool.query(
    `INSERT INTO notifications (user_id, ticket_id, type, title, body)
     VALUES ($1, $2, 'APPROVAL_REQUESTED', $3, $4)`,
    [user.id, args.ticketId, "Approval required", args.actionTitle]
  );

  const apiUrl = getPublicApiUrl();
  const webUrl = getPublicWebUrl();

  const approveUrl = `${apiUrl}/api/v1/approvals/confirm/${token}?decision=approve`;
  const rejectUrl = `${apiUrl}/api/v1/approvals/confirm/${token}?decision=reject`;

  await sendMail({
    to: user.email,
    subject: `[TICKET-${args.ticketId}] Approval needed: ${args.actionTitle}`,
    text:
      `${args.actionBody}\n\n` +
      `Approve: ${approveUrl}\n` +
      `Reject: ${rejectUrl}\n\n` +
      `View ticket: ${webUrl}/app/tickets/${args.ticketId}`,
  });

  return { request, token };
}

export async function getPendingApprovalForTicket(ticketId: string): Promise<ApprovalRequestRow | null> {
  const res = await pool.query<ApprovalRequestRow>(
    `SELECT * FROM approval_requests
     WHERE ticket_id = $1 AND status = 'pending'
     ORDER BY created_at DESC
     LIMIT 1`,
    [ticketId]
  );
  return res.rows[0] ?? null;
}

export async function getApprovalByToken(token: string): Promise<ApprovalRequestRow | null> {
  const tokenHash = sha256Hex(token);
  const res = await pool.query<ApprovalRequestRow>(
    `SELECT * FROM approval_requests
     WHERE token_hash = $1
     LIMIT 1`,
    [tokenHash]
  );
  return res.rows[0] ?? null;
}

export async function decideApproval(args: {
  approvalId: string;
  decision: "approved" | "rejected";
}): Promise<ApprovalRequestRow> {
  const res = await pool.query<ApprovalRequestRow>(
    `UPDATE approval_requests
     SET status = $2,
         decided_at = now()
     WHERE id = $1 AND status = 'pending'
     RETURNING *`,
    [args.approvalId, args.decision]
  );

  const row = res.rows[0];
  if (!row) {
    const err = new Error("Approval request not found or already decided");
    (err as any).statusCode = 404;
    throw err;
  }

  return row;
}
