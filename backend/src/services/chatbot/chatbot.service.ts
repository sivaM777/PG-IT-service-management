import { pool } from "../../config/db.js";
import { createTicket } from "../tickets/ticket.service.js";
import { findUserByEmail } from "../auth/auth.service.js";
import crypto from "crypto";

export interface ChatMessage {
  id: string;
  sessionId: string;
  role: "user" | "assistant" | "system";
  content: string;
  intent?: string;
  confidence?: number;
  kbArticlesSuggested?: string[];
  ticketCreatedId?: string;
  autoResolved?: boolean;
  createdAt: Date;
}

export interface ChatSession {
  id: string;
  userId: string | null;
  sessionToken: string;
  createdAt: Date;
  updatedAt: Date;
  lastActivityAt: Date;
  metadata: Record<string, any> | null;
}

/**
 * Create or get chatbot session
 */
export async function getOrCreateSession(
  userId: string | null,
  sessionToken?: string
): Promise<ChatSession> {
  if (sessionToken) {
    const result = await pool.query<ChatSession>(
      "SELECT * FROM chatbot_sessions WHERE session_token = $1",
      [sessionToken]
    );

    if (result.rows.length > 0) {
      return result.rows[0];
    }
  }

  // Create new session
  const newToken = sessionToken || crypto.randomBytes(32).toString("hex");
  const result = await pool.query<ChatSession>(
    `INSERT INTO chatbot_sessions (user_id, session_token)
     VALUES ($1, $2)
     RETURNING *`,
    [userId, newToken]
  );

  return result.rows[0];
}

/**
 * Get session messages
 */
export async function getSessionMessages(
  sessionId: string,
  limit: number = 50
): Promise<ChatMessage[]> {
  const result = await pool.query<ChatMessage>(
    `SELECT * FROM chatbot_messages 
     WHERE session_id = $1 
     ORDER BY created_at ASC 
     LIMIT $2`,
    [sessionId, limit]
  );
  return result.rows;
}

/**
 * Save message to session
 */
export async function saveMessage(args: {
  sessionId: string;
  role: "user" | "assistant" | "system";
  content: string;
  intent?: string;
  confidence?: number;
  kbArticlesSuggested?: string[];
  ticketCreatedId?: string;
  autoResolved?: boolean;
}): Promise<ChatMessage> {
  const result = await pool.query<ChatMessage>(
    `INSERT INTO chatbot_messages 
     (session_id, role, content, intent, confidence, kb_articles_suggested, ticket_created_id, auto_resolved)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING *`,
    [
      args.sessionId,
      args.role,
      args.content,
      args.intent || null,
      args.confidence || null,
      args.kbArticlesSuggested || null,
      args.ticketCreatedId || null,
      args.autoResolved || false,
    ]
  );

  return result.rows[0];
}

/**
 * Search knowledge base for relevant articles
 */
export async function searchKnowledgeBase(
  query: string,
  limit: number = 5
): Promise<Array<{ id: string; title: string; body: string; category: string; relevance: number }>> {
  // Simple text search - in production, use vector embeddings for semantic search
  const result = await pool.query(
    `SELECT 
       id, title, body, category,
       ts_rank(
         to_tsvector('english', COALESCE(title, '') || ' ' || COALESCE(body, '')),
         plainto_tsquery('english', $1)
       ) as relevance
     FROM kb_articles
     WHERE 
       to_tsvector('english', COALESCE(title, '') || ' ' || COALESCE(body, '')) 
       @@ plainto_tsquery('english', $1)
     ORDER BY relevance DESC
     LIMIT $2`,
    [query, limit]
  );

  return result.rows.map((row) => ({
    id: row.id,
    title: row.title,
    body: row.body.substring(0, 500), // Truncate for response
    category: row.category,
    relevance: parseFloat(row.relevance) || 0,
  }));
}

/**
 * Detect intent from user message - Comprehensive intent detection
 */
export function detectIntent(message: string): {
  intent: string;
  confidence: number;
} {
  const lowerMessage = message.toLowerCase();

  // Comprehensive intent detection covering all question types
  const intents = [
    // Password & Account Access
    {
      intent: "password_reset",
      keywords: ["password", "reset", "forgot password", "change password", "password expired", "reset password"],
      confidence: 0.9,
    },
    {
      intent: "account_unlock",
      keywords: ["unlock", "locked", "account locked", "unlock account", "account disabled"],
      confidence: 0.9,
    },
    {
      intent: "account_access",
      keywords: ["cannot login", "can't login", "login failed", "access denied", "permission denied"],
      confidence: 0.85,
    },
    // Network & VPN
    {
      intent: "vpn_access",
      keywords: ["vpn", "remote access", "connect vpn", "vpn connection", "virtual private network", "vpn not working", "vpn not connecting", "cannot connect vpn"],
      confidence: 0.9,
    },
    {
      intent: "wifi_issue",
      keywords: ["wifi", "wi-fi", "wireless", "cannot connect wifi", "wifi not working", "internet connection", "wifi connection", "network connection"],
      confidence: 0.85,
    },
    {
      intent: "network_issue",
      keywords: ["network", "connection", "cannot connect", "no internet", "slow internet", "network drive"],
      confidence: 0.8,
    },
    // Email & Collaboration
    {
      intent: "email_issue",
      keywords: ["email", "outlook", "mail", "cannot send email", "email not working", "not receiving email"],
      confidence: 0.85,
    },
    {
      intent: "calendar_issue",
      keywords: ["calendar", "meeting", "schedule", "calendar not syncing", "outlook calendar"],
      confidence: 0.8,
    },
    // Hardware
    {
      intent: "hardware_issue",
      keywords: ["laptop", "computer", "printer", "monitor", "keyboard", "mouse", "headphones", "hardware"],
      confidence: 0.8,
    },
    {
      intent: "printer_issue",
      keywords: ["printer", "printing", "cannot print", "print error", "printer not working"],
      confidence: 0.9,
    },
    // Software
    {
      intent: "software_install",
      keywords: ["install", "software", "application", "program", "download", "need software"],
      confidence: 0.85,
    },
    {
      intent: "software_issue",
      keywords: ["software not working", "application crashed", "program error", "software update"],
      confidence: 0.8,
    },
    // Business Applications
    {
      intent: "sap_issue",
      keywords: ["sap", "sap system", "sap login", "sap error"],
      confidence: 0.9,
    },
    {
      intent: "crm_issue",
      keywords: ["crm", "salesforce", "crm system", "customer relationship"],
      confidence: 0.85,
    },
    {
      intent: "erp_issue",
      keywords: ["erp", "oracle", "erp system", "enterprise resource"],
      confidence: 0.85,
    },
    // Security
    {
      intent: "security_incident",
      keywords: ["phishing", "virus", "malware", "suspicious", "security", "hacked", "breach", "stolen", "lost laptop"],
      confidence: 0.95,
    },
    // How-to Questions
    {
      intent: "how_to",
      keywords: ["how to", "how do i", "how can i", "tutorial", "guide", "instructions", "steps"],
      confidence: 0.8,
    },
    // General Support
    {
      intent: "backup_issue",
      keywords: ["backup", "backup failed", "backup not working", "backup error", "cannot backup", "backup system", "database backup", "server backup", "cloud backup", "backup drive", "backup storage", "restore backup", "backup corrupted", "backup verification", "backup schedule", "automatic backup", "backup job", "backup process"],
      confidence: 0.9,
    },
    {
      intent: "create_ticket",
      keywords: ["ticket", "issue", "problem", "help", "support", "broken", "not working", "error"],
      confidence: 0.7,
    },
    {
      intent: "general_query",
      keywords: ["question", "wondering", "need help", "assistance"],
      confidence: 0.6,
    },
  ];

  // Check for multiple intent matches and return highest confidence
  let bestMatch = { intent: "general_query", confidence: 0.5 };
  
  for (const intentDef of intents) {
    const matches = intentDef.keywords.filter((keyword) => lowerMessage.includes(keyword)).length;
    if (matches > 0) {
      const calculatedConfidence = Math.min(intentDef.confidence + matches * 0.05, 0.95);
      if (calculatedConfidence > bestMatch.confidence) {
        bestMatch = {
          intent: intentDef.intent,
          confidence: calculatedConfidence,
        };
      }
    }
  }

  return bestMatch;
}

/**
 * Generate chatbot response using LLM or rules
 */
export async function generateResponse(args: {
  sessionId: string;
  userMessage: string;
  userId: string | null;
  llmApiKey?: string;
  llmProvider?: "openai" | "anthropic" | "local";
}): Promise<{
  response: string;
  intent: string;
  confidence: number;
  kbArticles?: Array<{ id: string; title: string; body: string }>;
  shouldCreateTicket: boolean;
  autoResolved: boolean;
}> {
  const { intent, confidence } = detectIntent(args.userMessage);

  // Search knowledge base
  const kbArticles = await searchKnowledgeBase(args.userMessage, 3);

  // Check if KB article can resolve the query
  let autoResolved = false;
  let response = "";

  // Always search KB first, but also provide intelligent responses
  if (kbArticles.length > 0 && kbArticles[0].relevance > 0.3) {
    // High relevance KB article found
    const topArticle = kbArticles[0];
    response = `I found a relevant solution for you:\n\n**${topArticle.title}**\n\n${topArticle.body}\n\nDid this help resolve your issue? If not, I can create a support ticket for further assistance.`;
    autoResolved = true;
  } else {
    // Use LLM or enhanced rule-based response
    if (args.llmApiKey && args.llmProvider === "openai") {
      try {
        response = await generateLLMResponse(args.userMessage, args.llmApiKey, kbArticles);
      } catch {
        // Fallback to enhanced rule-based
        response = generateRuleBasedResponse(intent, args.userMessage);
      }
    } else {
      // Enhanced rule-based responses (ChatGPT-like)
      response = generateRuleBasedResponse(intent, args.userMessage);
      
      // If KB articles found but low relevance, mention them
      if (kbArticles.length > 0) {
        response += `\n\nI also found some related articles that might help:\n${kbArticles.slice(0, 2).map(a => `- ${a.title}`).join('\n')}`;
      }
    }
  }

  // Determine if ticket should be created
  const shouldCreateTicket =
    intent === "create_ticket" ||
    (intent === "general_query" && confidence < 0.5) ||
    (kbArticles.length === 0 && !autoResolved);

  return {
    response,
    intent,
    confidence,
    kbArticles: kbArticles.map((a) => ({ id: a.id, title: a.title, body: a.body })),
    shouldCreateTicket,
    autoResolved,
  };
}

/**
 * Generate response using OpenAI
 */
async function generateLLMResponse(
  userMessage: string,
  apiKey: string,
  kbArticles: Array<{ title: string; body: string }>
): Promise<string> {
  const kbContext = kbArticles
    .map((a, i) => `Article ${i + 1}: ${a.title}\n${a.body}`)
    .join("\n\n");

  const systemPrompt = `You are a helpful, friendly IT support chatbot assistant. Your goal is to help users resolve their IT issues quickly and efficiently.

Guidelines:
- Be conversational and helpful, like ChatGPT
- Provide step-by-step solutions when possible
- Ask clarifying questions if needed
- Don't ask for employee ID unless absolutely necessary for account-specific actions
- If you can't resolve directly, offer to create a support ticket
- Be concise but thorough
${kbContext ? `\n\nRelevant knowledge base articles:\n${kbContext}` : ""}

Respond naturally and helpfully. If the issue requires account verification or cannot be resolved through self-service, offer to create a support ticket.`;

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userMessage },
        ],
        max_tokens: 500,
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.statusText}`);
    }

    const data = await response.json();
    return data.choices[0]?.message?.content || "I apologize, I couldn't generate a response.";
  } catch (err) {
    console.error("LLM API error:", err);
    return generateRuleBasedResponse("general_query", userMessage);
  }
}

/**
 * Generate comprehensive rule-based response covering all question types
 */
function generateRuleBasedResponse(intent: string, userMessage: string): string {
  const responses: Record<string, string> = {
    // Password & Account
    password_reset: "I can help you reset your password! Here are your options:\n\n**Option 1: Self-Service Portal**\n- Go to the password reset portal\n- Enter your username or email\n- Follow the verification steps\n- Create a new strong password\n\n**Option 2: I can help you directly**\n- If you're logged in, I can guide you through the reset process\n- If you're locked out, I'll create a ticket for IT support to help\n\nWhat's your username or email? I'll help you get back into your account quickly.",
    account_unlock: "I can help unlock your account! Here's what happens:\n\n1. **Wait 15 minutes** - Sometimes accounts unlock automatically after a short wait\n2. **If still locked** - I'll create a ticket for IT support\n3. **Provide your username** - So we can identify your account\n\nAccounts usually get locked after multiple failed login attempts. Once unlocked, make sure to use the correct password. What's your username?",
    account_access: "I understand you're having trouble accessing your account. Let me help troubleshoot:\n\n**Common issues and solutions:**\n1. **Wrong password** - Double-check caps lock and spelling\n2. **Account locked** - Wait 15 minutes or I can request an unlock\n3. **Forgot password** - I can help you reset it\n4. **Account disabled** - Contact IT support for reactivation\n\nWhat error message are you seeing when you try to login? This will help me diagnose the exact issue.",
    
    // Network & VPN
    vpn_access: "I can help you with VPN connection issues. Let me troubleshoot this step by step:\n\n1. **Check your internet connection** - Make sure you have a stable internet connection first\n2. **Verify VPN credentials** - Ensure your username and password are correct\n3. **Check VPN client** - Make sure the VPN client is installed and up to date\n4. **Try reconnecting** - Close and restart the VPN client\n\nIf you're trying to set up VPN for the first time, I can guide you through the installation process. What specific issue are you experiencing? Are you getting an error message?",
    wifi_issue: "I can help troubleshoot your WiFi connection. Here are some quick steps:\n\n1. **Check WiFi is enabled** - Make sure WiFi is turned on on your device\n2. **Forget and reconnect** - Forget the network and reconnect with the password\n3. **Restart device** - Sometimes a simple restart fixes connection issues\n4. **Check signal strength** - Move closer to the router if signal is weak\n5. **Verify password** - Make sure you're using the correct WiFi password\n\nAre you trying to connect to the office WiFi or home network? What error message are you seeing?",
    network_issue: "I understand you're experiencing network connectivity issues. Let me help troubleshoot. Please tell me: What are you trying to access? Are you in the office or working remotely? This will help me provide the right solution.",
    
    // Email & Collaboration
    email_issue: "I can help with your email issue. Please provide details: Are you unable to send emails, receive emails, or both? Which email client are you using (Outlook, webmail)? I'll help resolve this quickly.",
    calendar_issue: "I can help with your calendar problem. Please describe the issue: Is your calendar not syncing, are meetings not showing up, or something else? I'll help get your calendar working properly.",
    
    // Hardware
    hardware_issue: "I can help with your hardware issue. Please describe the problem in detail: What device is affected? What exactly is happening? I'll help troubleshoot or arrange for hardware replacement if needed.",
    printer_issue: "I can help resolve your printer issue. Let me gather some information: Which printer are you trying to use? What error message appears? Are you printing from your computer or mobile device? I'll help get you printing again.",
    
    // Software
    software_install: "I can help you install software. Please tell me: What software do you need? Is it for business use? I'll check if you have the necessary permissions and guide you through the installation process.",
    software_issue: "I can help troubleshoot your software issue. Please provide details: Which application is having problems? What error message do you see? When did this start? I'll help resolve this.",
    
    // Business Applications
    sap_issue: "I can help with your SAP issue. Please provide details: What are you trying to do in SAP? What error message appears? I'll help troubleshoot or escalate to the SAP support team if needed.",
    crm_issue: "I can help with your CRM system issue. Please describe the problem: Are you unable to login, is the system slow, or is there a specific feature not working? I'll help resolve this.",
    erp_issue: "I can help with your ERP system issue. Please provide details: What system are you using (Oracle, SAP, etc.)? What problem are you experiencing? I'll help troubleshoot or escalate as needed.",
    
    // Security
    security_incident: "This appears to be a security-related issue. For your safety, I'm creating a high-priority security ticket immediately. Please provide as many details as possible: What happened? When did you notice this? Have you clicked any suspicious links? Our security team will respond urgently.",
    
    // How-to Questions
    how_to: "I'd be happy to guide you! Please tell me what you're trying to accomplish, and I'll provide step-by-step instructions. If it's something I can't explain here, I'll find the relevant knowledge base article or create a ticket for hands-on assistance.",
    
    // Backup Issues
    backup_issue: "I can help troubleshoot your backup issue. Let me gather some information:\n\n**Common backup problems and solutions:**\n1. **Backup storage full** - Check available storage space\n2. **Backup schedule stopped** - Verify backup job is enabled\n3. **Network connectivity** - Ensure connection to backup server\n4. **Permissions** - Verify backup service account has proper access\n5. **Backup software** - Check if backup application is running\n\n**To help diagnose:**\n- What type of backup? (File backup, database backup, system backup)\n- When did it last work?\n- What error message do you see?\n- Is this affecting critical data?\n\nI'll help you resolve this or create a ticket for the backup team. What specific backup issue are you experiencing?",
    
    // General Support  
    create_ticket: "I'll create a support ticket for you right away! To help us resolve your issue quickly, please provide:\n\n1. **What's the problem?** - A clear description of what's not working\n2. **When did it start?** - When did you first notice this issue?\n3. **Error messages?** - Any error messages or codes you've seen\n4. **What have you tried?** - Any troubleshooting steps you've already attempted\n\nOnce you provide these details, I'll create the ticket and assign it to the right team. What's the issue you're experiencing?",
    general_query: "I'm here to help! I can assist with:\n\n✅ **Password resets and account access**\n✅ **Network and VPN issues**\n✅ **Email and collaboration problems**\n✅ **Hardware and software issues**\n✅ **Software installation requests**\n✅ **Security concerns**\n✅ **Backup and data recovery**\n✅ **General IT questions**\n\nTell me what you need help with, and I'll either provide a solution directly or create a support ticket for you. What can I help you with today?",
  };

  return responses[intent] || responses.general_query;
}

/**
 * Create ticket from chatbot conversation
 */
export async function createTicketFromChat(
  sessionId: string,
  userId: string | null,
  title: string,
  description: string
): Promise<string> {
  let actualUserId = userId;

  // If anonymous, try to find user by email in description
  if (!actualUserId) {
    const emailMatch = description.match(/([\w\.-]+@[\w\.-]+\.\w+)/);
    if (emailMatch) {
      const user = await findUserByEmail(emailMatch[1]);
      if (user) {
        actualUserId = user.id;
      }
    }
  }

  // If still no user, use a system user or throw error
  if (!actualUserId) {
    throw new Error("Cannot create ticket: User not identified");
  }

  const ticket = await createTicket({
    title,
    description,
    createdBy: actualUserId,
    performedBy: actualUserId,
    sourceType: "CHATBOT",
    sourceReference: { sessionId },
  });

  return ticket.id;
}
