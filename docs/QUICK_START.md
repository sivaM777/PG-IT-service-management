# Quick Start Guide - Enterprise IT Ticketing System

## 🚀 System Status

All services are running and migrations are applied. The system is ready to use!

## 📍 Access Points

- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:8000
- **API Docs**: http://localhost:8000/api/v1 (endpoints listed below)

## 🔐 Default Login Credentials

Based on seed data:
- **Admin**: admin@company.com / admin123
- **Agent**: agent@company.com / agent123
- **Employee**: employee@company.com / employee123

## 🎯 Quick Configuration Steps

### Step 1: Login as Admin
1. Go to http://localhost:3000
2. Click "Login"
3. Use admin credentials above

### Step 2: Configure Routing Rules
1. Navigate to **Admin → Settings → Routing Rules**
2. Click "Add Rule"
3. Example rule:
   - Name: "Network Issues → Network Team"
   - Category Filter: "Network"
   - Assign to Team: Select a team
   - Priority: 10
   - Enabled: Yes
4. Click "Save"

### Step 3: Configure Alert Rules
1. Navigate to **Admin → Settings → Alert Rules**
2. Click "Add Rule"
3. Example rule:
   - Name: "High Priority Alerts"
   - Event Type: "TICKET_CREATED"
   - Conditions: `{"priority": ["HIGH"]}`
   - Channels: Email, SMS (if configured)
   - Recipient Roles: ADMIN, AGENT
4. Click "Save"

### Step 4: Test Chatbot
1. As an employee, go to http://localhost:3000
2. Login with employee credentials
3. Click the chat widget (bottom right)
4. Try messages like:
   - "I forgot my password"
   - "I need VPN access"
   - "My computer is not working"

### Step 5: Test Ticket Creation & Routing
1. Create a ticket via frontend or chatbot
2. Check Admin → Ticket Inbox
3. Verify ticket is auto-assigned based on routing rules
4. Check notifications are sent based on alert rules

## 🔧 Optional: Configure Email Integration

### Via API:
```bash
curl -X POST http://localhost:8000/api/v1/integrations/email-sources \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "name": "Support Email",
    "email_address": "support@company.com",
    "imap_host": "imap.company.com",
    "imap_port": 993,
    "imap_secure": true,
    "imap_username": "support@company.com",
    "imap_password": "password",
    "enabled": true
  }'
```

### Manual Check:
```bash
curl -X POST http://localhost:8000/api/v1/integrations/email-sources/{id}/check \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## 🔧 Optional: Configure GLPI Integration

```bash
curl -X POST http://localhost:8000/api/v1/integrations/glpi/configs \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "name": "GLPI Production",
    "api_url": "https://glpi.company.com/apirest.php",
    "app_token": "your-app-token",
    "user_token": "your-user-token",
    "enabled": true,
    "sync_interval_minutes": 15
  }'
```

## 📊 Key Features to Test

### 1. Intelligent Routing
- Create tickets with different categories
- Verify auto-assignment to correct teams/agents
- Check routing history

### 2. Chatbot
- Test intent detection (password reset, VPN, etc.)
- Verify KB article suggestions
- Test automatic ticket creation

### 3. Alert System
- Create/update tickets
- Verify alerts sent based on rules
- Check alert history

### 4. KB Trend Analysis
- Create multiple tickets with similar issues
- Check Admin → Reports for trend suggestions
- Approve KB suggestions to create articles

## 🐛 Troubleshooting

### Backend not starting?
```bash
docker-compose logs backend
```

### Migrations not applied?
```bash
docker-compose exec db psql -U postgres -d pit_portal -c "SELECT filename FROM schema_migrations ORDER BY filename;"
```

### Chatbot not responding?
- Check if LLM_API_KEY is set (optional - uses rule-based fallback)
- Check backend logs: `docker-compose logs backend | grep chatbot`

### Email monitoring not working?
- Verify email source is configured and enabled
- Check backend logs: `docker-compose logs backend | grep email`

## 📚 Next Steps

1. **Customize Routing Rules** - Set up rules specific to your organization
2. **Configure Alert Rules** - Set up notifications for your workflow
3. **Add KB Articles** - Populate knowledge base
4. **Set Up Integrations** - Configure GLPI/Solman if needed
5. **Configure SMS** - Add Twilio credentials for SMS alerts
6. **Set Up LLM** - Add OpenAI API key for enhanced chatbot

## 🎉 You're All Set!

The system is fully operational. Start using it and customize as needed!
