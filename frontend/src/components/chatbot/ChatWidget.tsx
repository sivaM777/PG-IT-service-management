import React, { useState, useEffect, useRef } from "react";
import {
  Box,
  Paper,
  TextField,
  IconButton,
  Typography,
  CircularProgress,
} from "@mui/material";
import SendIcon from "@mui/icons-material/Send";
import CloseIcon from "@mui/icons-material/Close";
import ChatIcon from "@mui/icons-material/Chat";
import { api } from "../../services/api";
import { useAuth } from "../../services/auth";

interface Message {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  intent?: string;
  kbArticlesSuggested?: string[];
  ticketCreated?: { id: string };
  createdAt: string;
}

interface ChatWidgetProps {
  sessionToken?: string;
  onTicketCreated?: (ticketId: string) => void;
}

export const ChatWidget: React.FC<ChatWidgetProps> = ({
  sessionToken: initialSessionToken,
  onTicketCreated,
}) => {
  const { isAuthenticated } = useAuth();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [sessionToken, setSessionToken] = useState<string | undefined>(initialSessionToken);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  // Don't render if not authenticated
  if (!isAuthenticated) {
    return null;
  }

  useEffect(() => {
    if (open && !sessionToken) {
      initializeSession();
    }
  }, [open]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const initializeSession = async () => {
    try {
      const res = await api.post<{ sessionId: string; sessionToken: string }>(
        "/chatbot/session",
        {}
      );
      setSessionToken(res.data.sessionToken);
    } catch (err) {
      console.error("Failed to initialize chat session:", err);
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const sendMessage = async () => {
    if (!input.trim() || loading) return;

    const userMessage = input.trim();
    setInput("");
    setLoading(true);

    // Add user message to UI immediately
    const tempUserMessage: Message = {
      id: `temp-${Date.now()}`,
      role: "user",
      content: userMessage,
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, tempUserMessage]);

    try {
      const res = await api.post<{
        message: Message;
        kbArticles?: Array<{ id: string; title: string; body: string }>;
        shouldCreateTicket: boolean;
        ticketCreated: { id: string } | null;
        sessionToken: string;
      }>("/chatbot/message", {
        message: userMessage,
        sessionToken,
      });

      setSessionToken(res.data.sessionToken);

      // Replace temp message with actual
      setMessages((prev) => {
        const filtered = prev.filter((m) => m.id !== tempUserMessage.id);
        return [...filtered, tempUserMessage, res.data.message];
      });

      // Handle ticket creation
      if (res.data.ticketCreated) {
        onTicketCreated?.(res.data.ticketCreated.id);
      }
    } catch (err) {
      console.error("Failed to send message:", err);
      setMessages((prev) => [
        ...prev.filter((m) => m.id !== tempUserMessage.id),
        {
          ...tempUserMessage,
          content: "Sorry, I encountered an error. Please try again.",
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  if (!open) {
    return (
      <Box
        sx={{
          position: "fixed",
          bottom: 24,
          right: 24,
          zIndex: 1000,
        }}
      >
        <IconButton
          onClick={() => setOpen(true)}
          sx={{
            bgcolor: "primary.main",
            color: "white",
            width: 56,
            height: 56,
            "&:hover": { bgcolor: "primary.dark" },
          }}
        >
          <ChatIcon />
        </IconButton>
      </Box>
    );
  }

  return (
    <Paper
      sx={{
        position: "fixed",
        bottom: 24,
        right: 24,
        width: 400,
        height: 600,
        display: "flex",
        flexDirection: "column",
        zIndex: 1000,
        boxShadow: 4,
      }}
    >
      {/* Header */}
      <Box
        sx={{
          p: 2,
          bgcolor: "primary.main",
          color: "white",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <Typography variant="h6">IT Support Chat</Typography>
        <IconButton size="small" onClick={() => setOpen(false)} sx={{ color: "white" }}>
          <CloseIcon />
        </IconButton>
      </Box>

      {/* Messages */}
      <Box
        sx={{
          flex: 1,
          overflowY: "auto",
          p: 2,
          display: "flex",
          flexDirection: "column",
          gap: 1,
        }}
      >
        {messages.length === 0 && (
          <Typography variant="body2" color="text.secondary" sx={{ textAlign: "center", mt: 4 }}>
            Hello! How can I help you today?
          </Typography>
        )}

        {messages.map((msg) => (
          <Box
            key={msg.id}
            sx={{
              display: "flex",
              justifyContent: msg.role === "user" ? "flex-end" : "flex-start",
            }}
          >
            <Paper
              sx={{
                p: 1.5,
                maxWidth: "75%",
                bgcolor: msg.role === "user" ? "primary.light" : "grey.100",
                color: msg.role === "user" ? "white" : "text.primary",
              }}
            >
              <Typography variant="body2" sx={{ whiteSpace: "pre-wrap" }}>
                {msg.content}
              </Typography>
              {msg.ticketCreated && (
                <Typography variant="caption" sx={{ display: "block", mt: 1, opacity: 0.8 }}>
                  Ticket {msg.ticketCreated.id.substring(0, 8).toUpperCase()} created
                </Typography>
              )}
            </Paper>
          </Box>
        ))}

        {loading && (
          <Box sx={{ display: "flex", justifyContent: "flex-start" }}>
            <Paper sx={{ p: 1.5, bgcolor: "grey.100" }}>
              <CircularProgress size={16} />
            </Paper>
          </Box>
        )}

        <div ref={messagesEndRef} />
      </Box>

      {/* Input */}
      <Box sx={{ p: 2, borderTop: 1, borderColor: "divider" }}>
        <Box sx={{ display: "flex", gap: 1 }}>
          <TextField
            fullWidth
            size="small"
            placeholder="Type your message..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={handleKeyPress}
            disabled={loading}
            multiline
            maxRows={3}
          />
          <IconButton
            onClick={sendMessage}
            disabled={!input.trim() || loading}
            color="primary"
          >
            <SendIcon />
          </IconButton>
        </Box>
      </Box>
    </Paper>
  );
};
