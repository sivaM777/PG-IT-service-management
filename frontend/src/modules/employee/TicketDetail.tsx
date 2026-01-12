import React from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  Box,
  Typography,
  Card,
  CardContent,
  Button,
  Divider,
  List,
  ListItem,
  ListItemText,
  Alert,
  TextField,
  Stack,
  Avatar,
  CircularProgress,
} from "@mui/material";
import { ArrowBack } from "@mui/icons-material";
import { api, getApiErrorMessage } from "../../services/api";

type TicketStatus = "OPEN" | "IN_PROGRESS" | "RESOLVED" | "CLOSED";

type Ticket = {
  id: string;
  title: string;
  description: string;
  status: TicketStatus;
  priority: "LOW" | "MEDIUM" | "HIGH";
  category: string | null;
  created_at: string;
  updated_at: string;
  assigned_team_name?: string | null;
  assigned_agent_name?: string | null;
};

type TicketEvent = {
  id: string;
  action: string;
  old_value: unknown;
  new_value: unknown;
  performed_by: string;
  timestamp: string;
};

type TicketDetailResponse = {
  ticket: Ticket;
  events: TicketEvent[];
};

type TicketComment = {
  id: string;
  ticket_id: string;
  author_id: string;
  author_name: string;
  author_email: string;
  body: string;
  is_internal: boolean;
  created_at: string;
};

type ApprovalRequest = {
  id: string;
  ticket_id: string;
  status: "pending" | "approved" | "rejected" | "expired";
  action_title: string;
  action_body: string;
  created_at: string;
};

export const TicketDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [ticket, setTicket] = React.useState<Ticket | null>(null);
  const [events, setEvents] = React.useState<TicketEvent[]>([]);
  const [comments, setComments] = React.useState<TicketComment[]>([]);
  const [commentText, setCommentText] = React.useState<string>("");
  const [commentSubmitting, setCommentSubmitting] = React.useState(false);
  const [approval, setApproval] = React.useState<ApprovalRequest | null>(null);
  const [approvalSubmitting, setApprovalSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string>("");
  const [loading, setLoading] = React.useState(false);

  const load = React.useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError("");
    try {
      const res = await api.get<TicketDetailResponse>(`/tickets/${id}`);
      setTicket(res.data.ticket);
      setEvents(res.data.events || []);
      const c = await api.get<TicketComment[]>(`/tickets/${id}/comments`);
      setComments(c.data || []);

      const a = await api.get<{ approval: ApprovalRequest | null }>(
        `/approvals/tickets/${id}/pending`
      );
      setApproval(a.data.approval);
    } catch (e: unknown) {
      setError(getApiErrorMessage(e, "Failed to load ticket"));
    } finally {
      setLoading(false);
    }
  }, [id]);

  const approve = async () => {
    if (!approval) return;
    setApprovalSubmitting(true);
    setError("");
    try {
      await api.post(`/approvals/${approval.id}/approve`);
      await load();
    } catch (e: unknown) {
      setError(getApiErrorMessage(e, "Failed to approve"));
    } finally {
      setApprovalSubmitting(false);
    }
  };

  const reject = async () => {
    if (!approval) return;
    setApprovalSubmitting(true);
    setError("");
    try {
      await api.post(`/approvals/${approval.id}/reject`);
      await load();
    } catch (e: unknown) {
      setError(getApiErrorMessage(e, "Failed to reject"));
    } finally {
      setApprovalSubmitting(false);
    }
  };

  const submitComment = async () => {
    if (!id) return;
    const trimmed = commentText.trim();
    if (!trimmed) return;

    setCommentSubmitting(true);
    try {
      await api.post(`/tickets/${id}/comments`, { body: trimmed });
      setCommentText("");
      const c = await api.get<TicketComment[]>(`/tickets/${id}/comments`);
      setComments(c.data || []);
    } catch (e: unknown) {
      setError(getApiErrorMessage(e, "Failed to post reply"));
    } finally {
      setCommentSubmitting(false);
    }
  };

  React.useEffect(() => {
    void load();
  }, [load]);

  return (
    <Box>
      <Button startIcon={<ArrowBack />} sx={{ mb: 2 }} onClick={() => navigate("/app/tickets")}>
        Back
      </Button>

      <Typography variant="h4" gutterBottom>
        Ticket {id}
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {loading && <Typography color="text.secondary">Loading...</Typography>}

      {ticket && (
        <>
          <Card sx={{ mb: 2 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Details
              </Typography>
              <Typography variant="subtitle1">{ticket.title}</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                Status: {ticket.status} • Priority: {ticket.priority}
              </Typography>
              {(ticket.assigned_team_name || ticket.assigned_agent_name) && (
                <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                  Assigned:
                  {ticket.assigned_team_name ? ` ${ticket.assigned_team_name}` : ""}
                  {ticket.assigned_agent_name ? ` • ${ticket.assigned_agent_name}` : ""}
                </Typography>
              )}
              <Typography variant="body2" sx={{ mt: 2, whiteSpace: "pre-wrap" }}>
                {ticket.description}
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 2 }}>
                Updated {new Date(ticket.updated_at).toLocaleString()}
              </Typography>
            </CardContent>
          </Card>

          {approval && approval.status === "pending" && (
            <Alert severity="info" sx={{ mb: 2 }}>
              <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
                {approval.action_title}
              </Typography>
              <Typography variant="body2" sx={{ whiteSpace: "pre-wrap" }}>
                {approval.action_body}
              </Typography>
              <Stack direction="row" spacing={1} justifyContent="flex-end" sx={{ mt: 2 }}>
                <Button
                  variant="outlined"
                  color="inherit"
                  onClick={() => void reject()}
                  disabled={approvalSubmitting}
                >
                  Reject
                </Button>
                <Button
                  variant="contained"
                  onClick={() => void approve()}
                  disabled={approvalSubmitting}
                >
                  Approve
                </Button>
              </Stack>
            </Alert>
          )}

          <Card sx={{ mb: 2 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Conversation
              </Typography>

              <Stack spacing={2} sx={{ mb: 2 }}>
                {comments.map((c) => (
                  <Stack key={c.id} direction="row" spacing={1.5} alignItems="flex-start">
                    <Avatar sx={{ width: 32, height: 32 }}>{c.author_name?.[0]?.toUpperCase() || "U"}</Avatar>
                    <Box sx={{ flexGrow: 1 }}>
                      <Stack direction="row" spacing={1} alignItems="baseline" sx={{ mb: 0.5 }}>
                        <Typography variant="subtitle2">{c.author_name}</Typography>
                        <Typography variant="caption" color="text.secondary">
                          {new Date(c.created_at).toLocaleString()}
                        </Typography>
                      </Stack>
                      <Typography variant="body2" sx={{ whiteSpace: "pre-wrap" }}>
                        {c.body}
                      </Typography>
                    </Box>
                  </Stack>
                ))}

                {comments.length === 0 && <Typography color="text.secondary">No replies yet.</Typography>}
              </Stack>

              <Divider sx={{ mb: 2 }} />

              <TextField
                label="Add a reply"
                fullWidth
                multiline
                minRows={3}
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                disabled={commentSubmitting}
              />

              <Stack direction="row" justifyContent="flex-end" sx={{ mt: 2 }}>
                <Button variant="contained" onClick={() => void submitComment()} disabled={commentSubmitting || !commentText.trim()}>
                  {commentSubmitting ? (
                    <Stack direction="row" spacing={1} alignItems="center">
                      <CircularProgress size={16} color="inherit" />
                      <span>Posting…</span>
                    </Stack>
                  ) : (
                    "Post reply"
                  )}
                </Button>
              </Stack>
            </CardContent>
          </Card>

          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Event History
              </Typography>
              <List dense>
                {events.map((ev: TicketEvent, idx: number) => (
                  <React.Fragment key={ev.id}>
                    <ListItem>
                      <ListItemText
                        primary={ev.action}
                        secondary={new Date(ev.timestamp).toLocaleString()}
                      />
                    </ListItem>
                    {idx < events.length - 1 && <Divider />}
                  </React.Fragment>
                ))}
              </List>
              {events.length === 0 && (
                <Typography color="text.secondary">No events yet.</Typography>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </Box>
  );
};
