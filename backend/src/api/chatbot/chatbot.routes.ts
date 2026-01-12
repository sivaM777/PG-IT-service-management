import { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { requireAuth } from "../../middlewares/auth.js";
import {
  getOrCreateSession,
  getSessionMessages,
  saveMessage,
  generateResponse,
  createTicketFromChat,
} from "../../services/chatbot/chatbot.service.js";
import { env } from "../../config/env.js";

const sendMessageSchema = z.object({
  message: z.string().min(1).max(2000),
  sessionToken: z.string().optional(),
});

const createTicketFromChatSchema = z.object({
  sessionId: z.string().uuid(),
  title: z.string().min(1).max(200),
  description: z.string().min(1).max(2000),
});

export const chatbotRoutes: FastifyPluginAsync = async (server) => {
  // POST /chatbot/session - Create or get session
  server.post("/chatbot/session", async (request, reply) => {
    const user = (request as any).authUser || null;
    const body = z
      .object({
        sessionToken: z.string().optional(),
      })
      .parse(request.body || {});

    const session = await getOrCreateSession(user?.id || null, body.sessionToken);
    return reply.send({
      sessionId: session.id,
      sessionToken: session.sessionToken,
    });
  });

  // GET /chatbot/session/:sessionId/messages - Get session messages
  server.get(
    "/chatbot/session/:sessionId/messages",
    { preHandler: [requireAuth] },
    async (request, reply) => {
      const params = z.object({ sessionId: z.string().uuid() }).parse(request.params);
      const query = z
        .object({
          limit: z.coerce.number().int().min(1).max(100).default(50),
        })
        .parse(request.query);

      const messages = await getSessionMessages(params.sessionId, query.limit);
      return reply.send(messages);
    }
  );

  // POST /chatbot/message - Send message to chatbot
  server.post("/chatbot/message", async (request, reply) => {
    const user = (request as any).authUser || null;
    const body = sendMessageSchema.parse(request.body);

    // Get or create session
    const session = await getOrCreateSession(user?.id || null, body.sessionToken);

    // Save user message
    await saveMessage({
      sessionId: session.id,
      role: "user",
      content: body.message,
    });

    // Generate response
    const response = await generateResponse({
      sessionId: session.id,
      userMessage: body.message,
      userId: user?.id || null,
      llmApiKey: process.env.OPENAI_API_KEY,
      llmProvider: process.env.LLM_PROVIDER as any || "local",
    });

    // Save assistant response
    const assistantMessage = await saveMessage({
      sessionId: session.id,
      role: "assistant",
      content: response.response,
      intent: response.intent,
      confidence: response.confidence,
      kbArticlesSuggested: response.kbArticles?.map((a) => a.id),
      autoResolved: response.autoResolved,
    });

    // Create ticket if needed
    let ticketId: string | undefined;
    if (response.shouldCreateTicket && user) {
      try {
        ticketId = await createTicketFromChat(
          session.id,
          user.id,
          body.message.substring(0, 200),
          body.message
        );
        
        // Update message with ticket ID
        await saveMessage({
          sessionId: session.id,
          role: "system",
          content: `Ticket created: ${ticketId}`,
          ticketCreatedId: ticketId,
        });
      } catch (err) {
        console.error("Failed to create ticket from chat:", err);
      }
    }

    return reply.send({
      message: assistantMessage,
      kbArticles: response.kbArticles,
      shouldCreateTicket: response.shouldCreateTicket && !ticketId,
      ticketCreated: ticketId ? { id: ticketId } : null,
      sessionToken: session.sessionToken,
    });
  });

  // POST /chatbot/create-ticket - Create ticket from chat session
  server.post(
    "/chatbot/create-ticket",
    { preHandler: [requireAuth] },
    async (request, reply) => {
      const user = request.authUser!;
      const body = createTicketFromChatSchema.parse(request.body);

      const ticketId = await createTicketFromChat(
        body.sessionId,
        user.id,
        body.title,
        body.description
      );

      // Save system message
      await saveMessage({
        sessionId: body.sessionId,
        role: "system",
        content: `Ticket ${ticketId} created successfully.`,
        ticketCreatedId: ticketId,
      });

      return reply.send({ ticketId });
    }
  );
};
