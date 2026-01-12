import { pool } from "../../config/db.js";
import { createTicket } from "../tickets/ticket.service.js";
import { findUserByEmail } from "../auth/auth.service.js";
import { ParsedEmail } from "./imap-client.js";

export interface EmailTicketData {
  title: string;
  description: string;
  requesterEmail: string;
  requesterId?: string;
  attachments?: Array<{
    filename: string;
    contentType: string;
    content: Buffer;
  }>;
}

/**
 * Extract ticket information from email
 */
export function parseEmailToTicket(email: ParsedEmail): EmailTicketData {
  // Use subject as title, or first line of body if subject is empty
  let title = email.subject.trim();
  if (!title || title.length === 0) {
    const firstLine = email.text.split("\n")[0]?.trim() || "";
    title = firstLine.length > 200 ? firstLine.substring(0, 197) + "..." : firstLine;
  }
  if (title.length > 200) {
    title = title.substring(0, 197) + "...";
  }

  // Use text body as description, strip email signatures
  let description = email.text.trim();
  
  // Remove common email signature patterns
  description = description.replace(/--\s*\n.*$/s, ""); // Everything after "--"
  description = description.replace(/Sent from.*$/i, "");
  description = description.replace(/This email.*$/i, "");
  
  // Limit description length
  if (description.length > 2000) {
    description = description.substring(0, 1997) + "...";
  }

  // Extract email address from "from" field
  const emailMatch = email.from.match(/<([^>]+)>/) || email.from.match(/([\w\.-]+@[\w\.-]+\.\w+)/);
  const requesterEmail = emailMatch ? emailMatch[1] || emailMatch[0] : email.from;

  return {
    title: title || "Ticket from Email",
    description: description || "No description provided",
    requesterEmail: requesterEmail.toLowerCase(),
    attachments: email.attachments,
  };
}

/**
 * Create ticket from email
 */
export async function createTicketFromEmail(
  email: ParsedEmail,
  emailSourceId: string
): Promise<string> {
  const ticketData = parseEmailToTicket(email);

  // Try to find user by email, create as system user if not found
  let requesterId: string;
  const user = await findUserByEmail(ticketData.requesterEmail);
  
  if (user) {
    requesterId = user.id;
  } else {
    // Create a system user or use a default system user
    // For now, we'll need to handle this - could create user or use admin
    // This is a design decision - for now, throw error if user doesn't exist
    throw new Error(`User not found for email: ${ticketData.requesterEmail}`);
  }

  // Create ticket
  const ticket = await createTicket({
    title: ticketData.title,
    description: ticketData.description,
    createdBy: requesterId,
    performedBy: requesterId,
  });

  // Update ticket with source information
  await pool.query(
    `UPDATE tickets 
     SET source_type = 'EMAIL',
         source_reference = $1,
         integration_metadata = $2
     WHERE id = $3`,
    [
      JSON.stringify({ email_source_id: emailSourceId, message_id: email.messageId }),
      JSON.stringify({
        from: email.from,
        to: email.to,
        date: email.date.toISOString(),
        has_attachments: (ticketData.attachments?.length || 0) > 0,
      }),
      ticket.id,
    ]
  );

  // Store attachments if any (could be stored in S3 or file system)
  if (ticketData.attachments && ticketData.attachments.length > 0) {
    // TODO: Implement attachment storage
    // For now, just log
    console.log(`Ticket ${ticket.id} has ${ticketData.attachments.length} attachments`);
  }

  return ticket.id;
}

/**
 * Check if email is a reply to an existing ticket
 */
export async function findTicketByEmailReply(email: ParsedEmail): Promise<string | null> {
  // Check if email subject contains ticket reference
  // Format: "Re: [TICKET-123] Original subject"
  const ticketIdMatch = email.subject.match(/\[TICKET-([a-f0-9-]+)\]/i);
  if (ticketIdMatch) {
    return ticketIdMatch[1];
  }

  // Check if email is a reply to a notification email
  // Look for In-Reply-To header in metadata
  // This would require storing message IDs when sending notifications
  
  return null;
}
