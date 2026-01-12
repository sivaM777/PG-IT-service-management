import { pool } from "../../config/db.js";
import { ImapClient, ParsedEmail } from "./imap-client.js";
import { createTicketFromEmail, findTicketByEmailReply } from "./email-parser.service.js";
import { createTicketComment } from "../tickets/ticket.service.js";
import { findUserByEmail } from "../auth/auth.service.js";

interface EmailSourceRow {
  id: string;
  name: string;
  email_address: string;
  imap_host: string;
  imap_port: number;
  imap_secure: boolean;
  imap_username: string;
  imap_password: string;
  enabled: boolean;
  last_checked_at: string | null;
}

export class EmailMonitorService {
  private clients: Map<string, ImapClient> = new Map();
  private isRunning = false;

  /**
   * Load all enabled email sources and start monitoring
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      return;
    }

    this.isRunning = true;
    await this.loadAndStartClients();

    // Reload clients every 5 minutes in case config changes
    setInterval(() => {
      if (this.isRunning) {
        void this.loadAndStartClients();
      }
    }, 5 * 60 * 1000);
  }

  /**
   * Stop all email monitoring
   */
  async stop(): Promise<void> {
    this.isRunning = false;

    for (const [id, client] of this.clients.entries()) {
      try {
        await client.disconnect();
      } catch (err) {
        console.error(`Error disconnecting email client ${id}:`, err);
      }
    }

    this.clients.clear();
  }

  private async loadAndStartClients(): Promise<void> {
    const result = await pool.query<EmailSourceRow>(
      "SELECT * FROM email_sources WHERE enabled = true"
    );

    const currentIds = new Set(this.clients.keys());
    const configIds = new Set(result.rows.map((r) => r.id));

    // Remove clients that are no longer enabled
    for (const id of currentIds) {
      if (!configIds.has(id)) {
        const client = this.clients.get(id);
        if (client) {
          await client.disconnect();
          this.clients.delete(id);
        }
      }
    }

    // Add/update clients
    for (const source of result.rows) {
      if (this.clients.has(source.id)) {
        // Client exists, check if config changed
        // For simplicity, reconnect if config might have changed
        const client = this.clients.get(source.id);
        if (client) {
          await client.disconnect();
          this.clients.delete(source.id);
        }
      }

      // Create new client
      const client = new ImapClient({
        host: source.imap_host,
        port: source.imap_port,
        secure: source.imap_secure,
        username: source.imap_username,
        password: source.imap_password,
      });

      client.on("email", async (email: ParsedEmail) => {
        await this.handleEmail(email, source.id);
      });

      client.on("error", (err: Error) => {
        console.error(`Email client error for source ${source.id}:`, err);
      });

      try {
        await client.connect();
        client.startPolling(60000); // Check every minute
        this.clients.set(source.id, client);

        // Update last checked time
        await pool.query(
          "UPDATE email_sources SET last_checked_at = now() WHERE id = $1",
          [source.id]
        );
      } catch (err) {
        console.error(`Failed to connect email client for source ${source.id}:`, err);
      }
    }
  }

  private async handleEmail(email: ParsedEmail, sourceId: string): Promise<void> {
    try {
      // Check if this is a reply to an existing ticket
      const existingTicketId = await findTicketByEmailReply(email);
      
      if (existingTicketId) {
        const emailMatch =
          email.from.match(/<([^>]+)>/) || email.from.match(/([\w\.-]+@[\w\.-]+\.\w+)/);
        const fromEmailRaw = emailMatch ? emailMatch[1] || emailMatch[0] : email.from;
        const fromEmail = String(fromEmailRaw || "").toLowerCase();

        const user = fromEmail ? await findUserByEmail(fromEmail) : null;
        let authorId = user?.id ?? null;
        if (!authorId) {
          const admin = await pool.query<{ id: string }>(
            "SELECT id FROM users WHERE role = 'ADMIN' ORDER BY created_at ASC LIMIT 1"
          );
          authorId = admin.rows[0]?.id ?? null;
        }

        if (!authorId) {
          console.warn(`Email reply ignored (no author user found): ${email.messageId}`);
          return;
        }

        const bodyRaw = (email.text || "").trim();
        const body = bodyRaw.length > 5000 ? bodyRaw.substring(0, 4997) + "..." : bodyRaw;

        await createTicketComment({
          ticketId: existingTicketId,
          authorId,
          body,
          isInternal: false,
        });
        return;
      }

      // Create new ticket from email
      const ticketId = await createTicketFromEmail(email, sourceId);
      console.log(`Created ticket ${ticketId} from email ${email.messageId}`);
    } catch (err) {
      console.error(`Error handling email ${email.messageId}:`, err);
    }
  }

  /**
   * Manually check for new emails on a specific source
   */
  async checkSource(sourceId: string): Promise<void> {
    const client = this.clients.get(sourceId);
    if (!client) {
      throw new Error(`Email client not found for source ${sourceId}`);
    }

    const emails = await client.fetchNewEmails();
    for (const email of emails) {
      await this.handleEmail(email, sourceId);
    }
  }
}

// Singleton instance
export const emailMonitor = new EmailMonitorService();
