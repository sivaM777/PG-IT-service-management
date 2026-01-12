import { pool } from "../../config/db.js";

export interface GlpiConfig {
  apiUrl: string;
  appToken: string;
  userToken: string;
  sessionToken?: string;
}

export interface GlpiTicket {
  id: number;
  name: string;
  content: string;
  status: number;
  priority: number;
  category: number;
  requester: number;
  assignedTo?: number;
  createdAt: string;
  updatedAt: string;
}

/**
 * GLPI API Client
 */
export class GlpiClient {
  private config: GlpiConfig;
  private sessionToken: string | null = null;

  constructor(config: GlpiConfig) {
    this.config = config;
  }

  /**
   * Initialize session with GLPI
   */
  async initSession(): Promise<string> {
    const response = await fetch(`${this.config.apiUrl}/initSession`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "App-Token": this.config.appToken,
        "Authorization": `user_token ${this.config.userToken}`,
      },
    });

    if (!response.ok) {
      throw new Error(`GLPI session initialization failed: ${response.statusText}`);
    }

    const data = await response.json();
    this.sessionToken = data.session_token || null;
    if (!this.sessionToken) {
      throw new Error("Failed to obtain GLPI session token");
    }
    return this.sessionToken;
  }

  /**
   * Kill session
   */
  async killSession(): Promise<void> {
    if (!this.sessionToken) return;

    await fetch(`${this.config.apiUrl}/killSession`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "App-Token": this.config.appToken,
        "Session-Token": this.sessionToken,
      },
    });

    this.sessionToken = null;
  }

  /**
   * Get tickets from GLPI
   */
  async getTickets(filters?: Record<string, any>): Promise<GlpiTicket[]> {
    if (!this.sessionToken) {
      await this.initSession();
    }

    const queryParams = new URLSearchParams();
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        queryParams.append(`criteria[0][field]`, key);
        queryParams.append(`criteria[0][searchtype]`, "equals");
        queryParams.append(`criteria[0][value]`, String(value));
      });
    }

    const url = `${this.config.apiUrl}/Ticket?${queryParams.toString()}`;
    const response = await fetch(url, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "App-Token": this.config.appToken,
        "Session-Token": this.sessionToken!,
      },
    });

    if (!response.ok) {
      throw new Error(`GLPI API error: ${response.statusText}`);
    }

    const data = await response.json();
    return Array.isArray(data) ? data : [];
  }

  /**
   * Get ticket by ID
   */
  async getTicket(ticketId: number): Promise<GlpiTicket | null> {
    if (!this.sessionToken) {
      await this.initSession();
    }

    const response = await fetch(`${this.config.apiUrl}/Ticket/${ticketId}`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "App-Token": this.config.appToken,
        "Session-Token": this.sessionToken!,
      },
    });

    if (!response.ok) {
      if (response.status === 404) return null;
      throw new Error(`GLPI API error: ${response.statusText}`);
    }

    return await response.json();
  }

  /**
   * Update ticket in GLPI
   */
  async updateTicket(ticketId: number, updates: Partial<GlpiTicket>): Promise<GlpiTicket> {
    if (!this.sessionToken) {
      await this.initSession();
    }

    const response = await fetch(`${this.config.apiUrl}/Ticket/${ticketId}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        "App-Token": this.config.appToken,
        "Session-Token": this.sessionToken!,
      },
      body: JSON.stringify(updates),
    });

    if (!response.ok) {
      throw new Error(`GLPI API error: ${response.statusText}`);
    }

    return await response.json();
  }

  /**
   * Create ticket in GLPI
   */
  async createTicket(ticket: Partial<GlpiTicket>): Promise<GlpiTicket> {
    if (!this.sessionToken) {
      await this.initSession();
    }

    const response = await fetch(`${this.config.apiUrl}/Ticket`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "App-Token": this.config.appToken,
        "Session-Token": this.sessionToken!,
      },
      body: JSON.stringify(ticket),
    });

    if (!response.ok) {
      throw new Error(`GLPI API error: ${response.statusText}`);
    }

    return await response.json();
  }
}

/**
 * Map GLPI ticket to internal ticket format
 */
export function mapGlpiTicketToInternal(glpiTicket: GlpiTicket): {
  title: string;
  description: string;
  priority: "LOW" | "MEDIUM" | "HIGH";
  status: "OPEN" | "IN_PROGRESS" | "RESOLVED" | "CLOSED";
  externalId: string;
  externalData: Record<string, any>;
} {
  // Map GLPI priority (1-5) to internal priority
  const priorityMap: Record<number, "LOW" | "MEDIUM" | "HIGH"> = {
    1: "LOW",
    2: "LOW",
    3: "MEDIUM",
    4: "HIGH",
    5: "HIGH",
  };

  // Map GLPI status to internal status
  const statusMap: Record<number, "OPEN" | "IN_PROGRESS" | "RESOLVED" | "CLOSED"> = {
    1: "OPEN", // New
    2: "IN_PROGRESS", // In progress
    3: "RESOLVED", // Resolved
    4: "CLOSED", // Closed
    5: "CLOSED", // Cancelled
  };

  return {
    title: glpiTicket.name || "GLPI Ticket",
    description: glpiTicket.content || "",
    priority: priorityMap[glpiTicket.priority] || "MEDIUM",
    status: statusMap[glpiTicket.status] || "OPEN",
    externalId: String(glpiTicket.id),
    externalData: {
      glpiId: glpiTicket.id,
      glpiStatus: glpiTicket.status,
      glpiPriority: glpiTicket.priority,
      glpiCategory: glpiTicket.category,
    },
  };
}
