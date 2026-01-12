import { pool } from "../../config/db.js";
import { GlpiClient, mapGlpiTicketToInternal } from "./glpi-client.js";
import { createTicket } from "../tickets/ticket.service.js";
import { updateTicketStatus, assignTicket } from "../tickets/ticket.service.js";

interface GlpiSyncConfig {
  id: string;
  apiUrl: string;
  appToken: string;
  userToken: string;
  syncIntervalMinutes: number;
  enabled: boolean;
}

/**
 * Sync tickets from GLPI to internal system
 */
export async function syncGlpiTickets(configId: string): Promise<{ created: number; updated: number }> {
  // Get GLPI config
  const configResult = await pool.query<GlpiSyncConfig>(
    `SELECT * FROM external_system_configs WHERE id = $1 AND system_type = 'GLPI'`,
    [configId]
  );

  if (configResult.rows.length === 0) {
    throw new Error(`GLPI config not found: ${configId}`);
  }

  const config = configResult.rows[0];
  if (!config.enabled) {
    return { created: 0, updated: 0 };
  }

  const client = new GlpiClient({
    apiUrl: config.apiUrl,
    appToken: config.appToken,
    userToken: config.userToken,
  });

  try {
    // Get tickets from GLPI (last sync time could be stored)
    const glpiTickets = await client.getTickets();

    let created = 0;
    let updated = 0;

    for (const glpiTicket of glpiTickets) {
      // Check if ticket already exists
      const existingResult = await pool.query(
        `SELECT ticket_id FROM external_ticket_references 
         WHERE external_system = 'GLPI' AND external_ticket_id = $1`,
        [String(glpiTicket.id)]
      );

      const mapped = mapGlpiTicketToInternal(glpiTicket);

      if (existingResult.rows.length === 0) {
        // Create new ticket
        // Note: We need to find or create user for requester
        // For now, use a system user or the first admin
        const adminResult = await pool.query(
          `SELECT id FROM users WHERE role = 'ADMIN' LIMIT 1`
        );

        if (adminResult.rows.length === 0) {
          console.warn(`No admin user found, skipping GLPI ticket ${glpiTicket.id}`);
          continue;
        }

        const adminId = adminResult.rows[0].id;

        const ticket = await createTicket({
          title: mapped.title,
          description: mapped.description,
          createdBy: adminId,
          performedBy: adminId,
          sourceType: "GLPI",
          sourceReference: { glpiId: glpiTicket.id },
          integrationMetadata: mapped.externalData,
        });

        // Update status and priority
        if (mapped.status !== "OPEN" || mapped.priority !== "LOW") {
          // Status update would go here if needed
        }

        // Create external reference
        await pool.query(
          `INSERT INTO external_ticket_references 
           (ticket_id, external_system, external_ticket_id, external_url, external_data, sync_status)
           VALUES ($1, 'GLPI', $2, $3, $4, 'success')`,
          [
            ticket.id,
            mapped.externalId,
            `${config.apiUrl}/Ticket/${glpiTicket.id}`,
            JSON.stringify(mapped.externalData),
          ]
        );

        created++;
      } else {
        // Update existing ticket
        const ticketId = existingResult.rows[0].ticket_id;

        // Update ticket status if changed
        const ticketResult = await pool.query(
          `SELECT status FROM tickets WHERE id = $1`,
          [ticketId]
        );

        if (ticketResult.rows.length > 0) {
          const currentStatus = ticketResult.rows[0].status;
          if (currentStatus !== mapped.status) {
            // Update status (would need performedBy)
            // await updateTicketStatus({ ticketId, newStatus: mapped.status, performedBy: systemUserId });
          }
        }

        // Update external reference
        await pool.query(
          `UPDATE external_ticket_references 
           SET external_data = $1, last_synced_at = now(), sync_status = 'success'
           WHERE ticket_id = $2 AND external_system = 'GLPI'`,
          [JSON.stringify(mapped.externalData), ticketId]
        );

        updated++;
      }
    }

    // Update last sync time
    await pool.query(
      `UPDATE external_system_configs SET last_sync_at = now() WHERE id = $1`,
      [configId]
    );

    return { created, updated };
  } finally {
    await client.killSession();
  }
}

/**
 * Sync internal ticket to GLPI
 */
export async function syncTicketToGlpi(
  ticketId: string,
  glpiConfigId: string
): Promise<void> {
  // Get ticket details
  const ticketResult = await pool.query(
    `SELECT t.*, u.email as requester_email
     FROM tickets t
     JOIN users u ON u.id = t.created_by
     WHERE t.id = $1`,
    [ticketId]
  );

  if (ticketResult.rows.length === 0) {
    throw new Error(`Ticket not found: ${ticketId}`);
  }

  const ticket = ticketResult.rows[0];

  // Get GLPI config
  const configResult = await pool.query<GlpiSyncConfig>(
    `SELECT * FROM external_system_configs WHERE id = $1 AND system_type = 'GLPI'`,
    [glpiConfigId]
  );

  if (configResult.rows.length === 0) {
    throw new Error(`GLPI config not found: ${glpiConfigId}`);
  }

  const config = configResult.rows[0];
  const client = new GlpiClient({
    apiUrl: config.apiUrl,
    appToken: config.appToken,
    userToken: config.userToken,
  });

  try {
    // Check if GLPI ticket exists
    const externalRefResult = await pool.query(
      `SELECT external_ticket_id FROM external_ticket_references 
       WHERE ticket_id = $1 AND external_system = 'GLPI'`,
      [ticketId]
    );

    // Map internal status to GLPI status
    const statusMap: Record<string, number> = {
      OPEN: 1,
      IN_PROGRESS: 2,
      RESOLVED: 3,
      CLOSED: 4,
    };

    const priorityMap: Record<string, number> = {
      LOW: 2,
      MEDIUM: 3,
      HIGH: 5,
    };

    if (externalRefResult.rows.length > 0) {
      // Update existing GLPI ticket
      const glpiTicketId = parseInt(externalRefResult.rows[0].external_ticket_id);
      await client.updateTicket(glpiTicketId, {
        status: statusMap[ticket.status] || 1,
        priority: priorityMap[ticket.priority] || 3,
        name: ticket.title,
        content: ticket.description,
      } as any);
    } else {
      // Create new GLPI ticket
      const glpiTicket = await client.createTicket({
        name: ticket.title,
        content: ticket.description,
        status: statusMap[ticket.status] || 1,
        priority: priorityMap[ticket.priority] || 3,
      } as any);

      // Create external reference
      await pool.query(
        `INSERT INTO external_ticket_references 
         (ticket_id, external_system, external_ticket_id, external_url, external_data, sync_status)
         VALUES ($1, 'GLPI', $2, $3, $4, 'success')`,
        [
          ticketId,
          String(glpiTicket.id),
          `${config.apiUrl}/Ticket/${glpiTicket.id}`,
          JSON.stringify({ glpiId: glpiTicket.id }),
        ]
      );
    }
  } finally {
    await client.killSession();
  }
}
