import React from "react";
import { useNavigate } from "react-router-dom";
import {
  Box,
  Typography,
  Button,
  TextField,
  Alert,
} from "@mui/material";
import { Send } from "@mui/icons-material";
import { api, getApiErrorMessage } from "../../services/api";

type CreateTicketResponse = {
  id: string;
  category?: string | null;
  ai_confidence?: number | null;
};

export const Home: React.FC = () => {
  const navigate = useNavigate();
  const [message, setMessage] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState("");
  const [createdId, setCreatedId] = React.useState<string | null>(null);
  const [createdCategory, setCreatedCategory] = React.useState<string | null>(null);
  const [createdConfidence, setCreatedConfidence] = React.useState<number | null>(null);

  const submit = async () => {
    const text = message.trim();
    if (!text) return;
    setLoading(true);
    setError("");
    setCreatedId(null);
    setCreatedCategory(null);
    setCreatedConfidence(null);
    try {
      const title = text.length > 80 ? `${text.slice(0, 77)}...` : text;
      const res = await api.post<CreateTicketResponse>("/tickets", { title, description: text });
      setCreatedId(res.data.id);
      setCreatedCategory(res.data.category ?? null);
      setCreatedConfidence(res.data.ai_confidence ?? null);
      setMessage("");
    } catch (e: unknown) {
      setError(getApiErrorMessage(e, "Failed to create ticket"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        How can we help you today?
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {createdId && (
        <Alert severity="success" sx={{ mb: 2 }}>
          <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 2 }}>
            <Box>
              <Typography>Your ticket has been created. ID: {createdId}</Typography>
              {createdCategory && (
                <Typography variant="body2" color="text.secondary">
                  AI category: {createdCategory}
                  {typeof createdConfidence === "number" ? ` (${Math.round(createdConfidence * 100)}%)` : ""}
                </Typography>
              )}
            </Box>
            <Box sx={{ display: "flex", gap: 1 }}>
              <Button size="small" variant="outlined" onClick={() => navigate(`/app/tickets/${createdId}`)}>
                View
              </Button>
              <Button size="small" variant="text" onClick={() => navigate("/app/tickets")}>
                My Tickets
              </Button>
            </Box>
          </Box>
        </Alert>
      )}

      <TextField
        fullWidth
        multiline
        rows={3}
        value={message}
        onChange={(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
          setMessage(e.target.value)
        }
        placeholder="Type your issue here…"
      />
      <Box sx={{ mt: 2, display: "flex", justifyContent: "flex-end" }}>
        <Button
          variant="contained"
          endIcon={<Send />}
          disabled={loading || !message.trim()}
          onClick={submit}
        >
          {loading ? "Sending…" : "Send"}
        </Button>
      </Box>
    </Box>
  );
};
