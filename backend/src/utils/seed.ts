import { pool } from "../config/db.js";
import { hashPassword } from "../services/auth/auth.service.js";

const run = async () => {
  const adminPasswordHash = await hashPassword("admin123");
  const agentPasswordHash = await hashPassword("agent123");
  const employeePasswordHash = await hashPassword("employee123");

  const teamRes = await pool.query<{ id: string }>(
    "INSERT INTO teams (name) VALUES ($1) ON CONFLICT DO NOTHING RETURNING id",
    ["Network Team"]
  );

  let teamId = teamRes.rows[0]?.id ?? null;
  if (!teamId) {
    const existing = await pool.query<{ id: string }>("SELECT id FROM teams WHERE name = $1", ["Network Team"]);
    teamId = existing.rows[0]?.id ?? null;
  }

  await pool.query(
    `INSERT INTO users (name, email, password_hash, role, team_id)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (email) DO NOTHING`,
    ["Admin User", "admin@company.com", adminPasswordHash, "ADMIN", null]
  );

  await pool.query(
    `INSERT INTO users (name, email, password_hash, role, team_id)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (email) DO NOTHING`,
    ["Agent User", "agent@company.com", agentPasswordHash, "AGENT", teamId]
  );

  await pool.query(
    `INSERT INTO users (name, email, password_hash, role, team_id)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (email) DO NOTHING`,
    ["Employee User", "employee@company.com", employeePasswordHash, "EMPLOYEE", null]
  );

  await pool.query(
    `INSERT INTO kb_articles (title, body, category, tags)
     SELECT $1, $2, $3, $4::text[]
     WHERE NOT EXISTS (SELECT 1 FROM kb_articles WHERE title = $1)`,
    [
      "VPN not connecting (basic checks)",
      "1) Confirm internet connectivity.\n2) Confirm credentials.\n3) Reboot device.\n4) Reinstall VPN client if needed.\n5) If still failing, attach error screenshot and contact support.",
      "NETWORK_VPN_WIFI",
      ["vpn", "connectivity", "client"],
    ]
  );

  await pool.query(
    `INSERT INTO kb_articles (title, body, category, tags)
     SELECT $1, $2, $3, $4::text[]
     WHERE NOT EXISTS (SELECT 1 FROM kb_articles WHERE title = $1)`,
    [
      "Email account locked: unlock procedure",
      "If your email account is locked, wait 15 minutes and retry. If the lock persists, contact IT support with your username and last successful login time.",
      "IDENTITY_ACCESS",
      ["email", "account", "locked"],
    ]
  );

  await pool.query(
    `INSERT INTO kb_articles (title, body, category, tags)
     SELECT $1, $2, $3, $4::text[]
     WHERE NOT EXISTS (SELECT 1 FROM kb_articles WHERE title = $1)`,
    [
      "Wi‑Fi connected but no internet",
      "1) Forget and rejoin Wi‑Fi.\n2) Disable/enable adapter.\n3) Check captive portal.\n4) Flush DNS.\n5) If multiple users impacted, report as network incident.",
      "NETWORK_VPN_WIFI",
      ["wifi", "dns", "internet"],
    ]
  );

  await pool.query(
    `INSERT INTO kb_articles (title, body, category, tags)
     SELECT $1, $2, $3, $4::text[]
     WHERE NOT EXISTS (SELECT 1 FROM kb_articles WHERE title = $1)`,
    [
      "Software installation request policy",
      "Software installation requires manager approval and a valid license. Submit a ticket with software name, version, business justification, and device details.",
      "SOFTWARE_INSTALL_LICENSE",
      ["software", "install", "license", "policy"],
    ]
  );

  // Comprehensive Knowledge Base Articles for all question types
  const kbArticles = [
    // Password & Account Access
    {
      title: "How to Reset Your Password",
      body: "To reset your password:\n1. Go to the password reset portal\n2. Enter your username or email\n3. Follow the verification steps\n4. Create a new strong password\n5. If you're locked out, wait 15 minutes or contact IT support",
      category: "IDENTITY_ACCESS",
      tags: ["password", "reset", "account"],
    },
    {
      title: "Account Locked - How to Unlock",
      body: "If your account is locked:\n1. Wait 15 minutes and try again\n2. If still locked, contact IT support\n3. Provide your username and last successful login time\n4. We'll verify your identity and unlock your account",
      category: "IDENTITY_ACCESS",
      tags: ["account", "locked", "unlock"],
    },
    // VPN & Network
    {
      title: "How to Connect to VPN",
      body: "To connect to VPN:\n1. Open the VPN client application\n2. Enter your username and password\n3. Select the appropriate server location\n4. Click Connect\n5. If connection fails, check your internet connection and credentials",
      category: "NETWORK_VPN_WIFI",
      tags: ["vpn", "remote", "connect"],
    },
    {
      title: "WiFi Connection Troubleshooting",
      body: "If WiFi is not working:\n1. Forget the network and reconnect\n2. Restart your device\n3. Check if other devices can connect\n4. Move closer to the router\n5. Update WiFi drivers\n6. Contact IT if issue persists",
      category: "NETWORK_VPN_WIFI",
      tags: ["wifi", "wireless", "connection"],
    },
    // Email
    {
      title: "Email Not Sending - Troubleshooting",
      body: "If emails aren't sending:\n1. Check your internet connection\n2. Verify recipient email address\n3. Check if attachment is too large (max 25MB)\n4. Clear Outlook cache\n5. Restart Outlook\n6. Check if you're over quota",
      category: "EMAIL_COLLAB",
      tags: ["email", "outlook", "sending"],
    },
    {
      title: "Setting Up Email on Mobile Device",
      body: "To set up email on your phone:\n1. Go to Settings > Accounts > Add Account\n2. Select Exchange/Office 365\n3. Enter your email and password\n4. Server: outlook.office365.com\n5. Complete setup and sync",
      category: "EMAIL_COLLAB",
      tags: ["email", "mobile", "setup"],
    },
    // Hardware
    {
      title: "Printer Not Printing - Solutions",
      body: "If printer won't print:\n1. Check if printer is powered on\n2. Verify printer is connected to network\n3. Check printer queue for errors\n4. Restart print spooler service\n5. Reinstall printer driver\n6. Try printing from another device",
      category: "HARDWARE_PERIPHERAL",
      tags: ["printer", "printing", "hardware"],
    },
    {
      title: "Laptop Overheating - What to Do",
      body: "If laptop is overheating:\n1. Shut down and let it cool\n2. Clean vents and fans\n3. Use on hard surface (not bed/couch)\n4. Check for background processes\n5. Update BIOS and drivers\n6. If persists, contact IT for hardware check",
      category: "HARDWARE_PERIPHERAL",
      tags: ["laptop", "overheating", "hardware"],
    },
    // Software
    {
      title: "How to Request Software Installation",
      body: "To request software:\n1. Get manager approval\n2. Submit ticket with software name and version\n3. Provide business justification\n4. Include device information\n5. Wait for license approval\n6. IT will install remotely or provide instructions",
      category: "SOFTWARE_INSTALL_LICENSE",
      tags: ["software", "install", "request"],
    },
    // Security
    {
      title: "What to Do If You Receive a Phishing Email",
      body: "If you receive a suspicious email:\n1. DO NOT click any links or attachments\n2. Forward the email to security@company.com\n3. Delete the email\n4. If you clicked something, immediately contact IT security\n5. Change your password if compromised",
      category: "SECURITY_INCIDENT",
      tags: ["phishing", "security", "email"],
    },
    // Business Apps
    {
      title: "SAP Login Issues - Troubleshooting",
      body: "If you can't login to SAP:\n1. Verify your SAP credentials\n2. Check if your account is active\n3. Clear browser cache\n4. Try different browser\n5. Check VPN connection if remote\n6. Contact SAP support team",
      category: "BUSINESS_APP_ERP_CRM",
      tags: ["sap", "login", "erp"],
    },
  ];

  for (const article of kbArticles) {
    await pool.query(
      `INSERT INTO kb_articles (title, body, category, tags)
       SELECT $1, $2, $3, $4::text[]
       WHERE NOT EXISTS (SELECT 1 FROM kb_articles WHERE title = $1)`,
      [article.title, article.body, article.category, article.tags]
    );
  }

  const workflows = [
    {
      name: "PASSWORD_RESET",
      description: "AI-assisted password reset (requires employee approval)",
      enabled: true,
      priority: 100,
      intent_filter: ["ACCOUNT_ACCESS"],
      category_filter: ["IDENTITY_ACCESS"],
      keyword_filter: ["password"],
      steps: [
        {
          type: "approval",
          name: "Employee approval",
          config: {
            title: "Confirm password reset",
            body: "AI can reset your password and send a reset message. Approve to proceed.",
            expiresInHours: 24,
          },
        },
        {
          type: "ldap_query",
          name: "Password reset",
          config: { action: "password_reset" },
        },
      ],
      auto_resolve: true,
      create_ticket: false,
    },
    {
      name: "ACCOUNT_UNLOCK",
      description: "AI-assisted account unlock (requires employee approval)",
      enabled: true,
      priority: 90,
      intent_filter: ["ACCOUNT_ACCESS"],
      category_filter: ["IDENTITY_ACCESS"],
      keyword_filter: ["unlock"],
      steps: [
        {
          type: "approval",
          name: "Employee approval",
          config: {
            title: "Confirm account unlock",
            body: "AI can unlock your account. Approve to proceed.",
            expiresInHours: 24,
          },
        },
        {
          type: "ldap_query",
          name: "Account unlock",
          config: { action: "account_unlock" },
        },
      ],
      auto_resolve: true,
      create_ticket: false,
    },
    {
      name: "VPN_BASIC_FIX",
      description: "AI-guided VPN troubleshooting (requires employee approval)",
      enabled: true,
      priority: 70,
      intent_filter: null,
      category_filter: ["NETWORK_VPN_WIFI"],
      keyword_filter: ["vpn"],
      steps: [
        {
          type: "approval",
          name: "Employee approval",
          config: {
            title: "Confirm VPN troubleshooting",
            body: "AI can guide you through VPN troubleshooting steps. Approve to proceed.",
            expiresInHours: 24,
          },
        },
        {
          type: "script",
          name: "VPN steps",
          config: {
            script:
              "({ steps: [\"Confirm internet connectivity\", \"Check credentials\", \"Reboot device\", \"Reinstall VPN client if needed\"], note: \"If it still fails, reply with the exact error message or screenshot.\" })",
          },
        },
      ],
      auto_resolve: true,
      create_ticket: false,
    },
    {
      name: "PRINTER_TROUBLESHOOT",
      description: "AI-guided printer troubleshooting (requires employee approval)",
      enabled: true,
      priority: 60,
      intent_filter: null,
      category_filter: ["HARDWARE_PERIPHERAL"],
      keyword_filter: ["printer"],
      steps: [
        {
          type: "approval",
          name: "Employee approval",
          config: {
            title: "Confirm printer troubleshooting",
            body: "AI can guide you through printer troubleshooting steps. Approve to proceed.",
            expiresInHours: 24,
          },
        },
        {
          type: "script",
          name: "Printer steps",
          config: {
            script:
              "({ steps: [\"Check printer power and network\", \"Clear print queue\", \"Restart print spooler\", \"Reinstall printer driver\"], note: \"If the issue continues, share printer model and any error code shown.\" })",
          },
        },
      ],
      auto_resolve: true,
      create_ticket: false,
    },
  ];

  for (const wf of workflows) {
    await pool.query(
      `INSERT INTO workflows
       (name, description, enabled, priority, intent_filter, category_filter, keyword_filter, steps, auto_resolve, create_ticket)
       SELECT $1, $2, $3, $4, $5::text[], $6::text[], $7::text[], $8::jsonb, $9, $10
       WHERE NOT EXISTS (SELECT 1 FROM workflows WHERE name = $1)`,
      [
        wf.name,
        wf.description,
        wf.enabled,
        wf.priority,
        wf.intent_filter,
        wf.category_filter,
        wf.keyword_filter,
        JSON.stringify(wf.steps),
        wf.auto_resolve,
        wf.create_ticket,
      ]
    );
  }

  // eslint-disable-next-line no-console
  console.log("Seed complete. Demo users created (if not already present).\n" +
    "- admin@company.com / admin123\n" +
    "- agent@company.com / agent123\n" +
    "- employee@company.com / employee123");

  await pool.end();
};

run().catch((err) => {
  // eslint-disable-next-line no-console
  console.error("Seed failed", err);
  process.exit(1);
});
