import "dotenv/config";

import Fastify, { FastifyInstance } from "fastify";
import cors from "@fastify/cors";
import cookie from "@fastify/cookie";
import jwt from "@fastify/jwt";
import { pathToFileURL } from "url";

import { authRoutes } from "./api/auth/auth.routes.js";
import { ticketRoutes } from "./api/tickets/ticket.routes.js";
import { kbRoutes } from "./api/kb/kb.routes.js";
import { userRoutes } from "./api/users/user.routes.js";
import { notificationRoutes } from "./api/notifications/notification.routes.js";
import { teamRoutes } from "./api/teams/team.routes.js";
import { emailRoutes } from "./api/integrations/email.routes.js";
import { emailMonitor } from "./services/integrations/email-monitor.service.js";
import { routingRoutes } from "./api/routing/routing.routes.js";
import { alertRulesRoutes } from "./api/alerts/alert-rules.routes.js";
import { chatbotRoutes } from "./api/chatbot/chatbot.routes.js";
import { glpiRoutes } from "./api/integrations/glpi.routes.js";
import { kbTrendRoutes } from "./api/kb/kb-trend.routes.js";
import { workflowRoutes } from "./api/workflows/workflow.routes.js";
import { approvalRoutes } from "./api/approvals/approval.routes.js";
import { initSmsService } from "./services/notifications/sms.service.js";
import { env } from "./config/env.js";

export const server: FastifyInstance = Fastify({
  logger: true,
});

server.register(cors, {
  origin: true,
  credentials: true,
});

server.register(cookie);
server.register(jwt, { secret: process.env.JWT_SECRET || "supersecret" });

// Register routes
server.register(authRoutes, { prefix: "/api/v1/auth" });
server.register(ticketRoutes, { prefix: "/api/v1/tickets" });
server.register(kbRoutes, { prefix: "/api/v1/kb" });
server.register(userRoutes, { prefix: "/api/v1/users" });
server.register(teamRoutes, { prefix: "/api/v1/teams" });
server.register(notificationRoutes, { prefix: "/api/v1/notifications" });
server.register(emailRoutes, { prefix: "/api/v1/integrations" });
server.register(routingRoutes, { prefix: "/api/v1" });
server.register(alertRulesRoutes, { prefix: "/api/v1" });
server.register(chatbotRoutes, { prefix: "/api/v1" });
server.register(glpiRoutes, { prefix: "/api/v1" });
server.register(kbTrendRoutes, { prefix: "/api/v1" });
server.register(workflowRoutes, { prefix: "/api/v1" });
server.register(approvalRoutes, { prefix: "/api/v1" });

// Health check
server.get("/health", async () => ({ status: "ok" }));

const start = async () => {
  try {
    const port = Number(process.env.PORT ?? 8000);
    await server.listen({ port, host: "0.0.0.0" });
    server.log.info(`Server listening on http://0.0.0.0:${port}`);

    // Initialize SMS service
    if (env.SMS_PROVIDER) {
      initSmsService({
        provider: env.SMS_PROVIDER as any,
        twilioAccountSid: env.TWILIO_ACCOUNT_SID,
        twilioAuthToken: env.TWILIO_AUTH_TOKEN,
        twilioFromNumber: env.TWILIO_FROM_NUMBER,
        awsAccessKeyId: env.AWS_ACCESS_KEY_ID,
        awsSecretAccessKey: env.AWS_SECRET_ACCESS_KEY,
        awsRegion: env.AWS_REGION,
        customApiUrl: env.SMS_CUSTOM_API_URL,
        customApiKey: env.SMS_CUSTOM_API_KEY,
      });
      server.log.info("SMS service initialized");
    }

    // Start email monitoring service
    try {
      await emailMonitor.start();
      server.log.info("Email monitoring service started");
    } catch (err) {
      server.log.warn(`Failed to start email monitoring: ${err instanceof Error ? err.message : String(err)}`);
    }
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
};

let started = false;
const startOnce = () => {
  if (started) return;
  started = true;
  void start();
};

// When this module is executed directly via `node dist/server.js`, start the server.
// This is ESM-safe (no `require.main`).
if (process.argv[1]) {
  const argvUrl = pathToFileURL(process.argv[1]).href;
  if (import.meta.url === argvUrl) {
    startOnce();
  }
}

// Support `tsx watch src/server.ts` where process.argv[1] points to tsx.
if (process.argv.some((a: string) => /server\.(ts|js)$/.test(a))) {
  startOnce();
}
