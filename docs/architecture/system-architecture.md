# System Architecture

## High-Level Diagram

```
┌───────────────┐
│   Frontend    │ (React + TypeScript, role-based UI)
└───────┬───────┘
        │ HTTP/REST
┌───────▼───────┐
│   Backend     │ (FastAPI/Node, modular)
│ - Auth        │
│ - Tickets API │
│ - KB API      │
│ - Routing     │
│ - Events      │
└───────┬───────┘
        │
┌───────▼───────┐
│ AI Services   │ (Python NLP)
│ - Classifier   │
│ - Intent       │
└───────┬───────┘
        │
┌───────▼───────┐
│ Database      │ (PostgreSQL)
│ - Tickets     │
│ - Users       │
│ - Teams       │
│ - AuditLog    │
└───────────────┘
```

## Data Flow

1. **Ticket Ingestion**
   - Frontend POST /tickets
   - Auth middleware validates JWT
   - Ticket saved with status Open

2. **AI Classification**
   - Backend forwards ticket text to AI Service
   - Returns category + intent + confidence
   - Stored on ticket record

3. **Routing**
   - Rules engine maps category → team
   - Urgent keywords raise priority
   - Assignment persisted

4. **Notifications**
   - Event publisher emits TicketCreated, TicketAssigned
   - Notification service sends Email/SMS

5. **Self-Service**
   - Chatbot searches Knowledge Base
   - If article resolves, ticket auto-closed
   - Feedback logged

## Security Layers

- JWT-based auth
- Role-based access control (Employee/Admin)
- Input validation and sanitization
- Audit log for all state changes
- API rate limiting (future)
