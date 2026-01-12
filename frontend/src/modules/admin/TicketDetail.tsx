import React from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  Box,
  Typography,
  Card,
  CardContent,
  Button,
  TextField,
  FormControl,
  InputLabel,
  Select,
  SelectChangeEvent,
  MenuItem,
  Grid,
  List,
  ListItem,
  ListItemText,
  Divider,
  Alert,
  Chip,
} from "@mui/material";
import { Save, ArrowBack } from "@mui/icons-material";
import { api, getApiErrorMessage } from "../../services/api";
import { TicketFlowVisualization } from "../../components/TicketFlowVisualization";

type TicketStatus = "OPEN" | "IN_PROGRESS" | "RESOLVED" | "CLOSED";
type TicketPriority = "LOW" | "MEDIUM" | "HIGH";

type Ticket = {
  id: string;
  title: string;
  description: string;
  status: TicketStatus;
  priority: TicketPriority;
  category: string | null;
  ai_confidence: number | null;
  source_type: string | null;
  assigned_team: string | null;
  assigned_agent: string | null;
  requester_email: string;
  requester_name: string;
  assigned_team_name: string | null;
  assigned_agent_name: string | null;
  updated_at: string;
};

type TicketEvent = {
  id: string;
  action: string;
  old_value: unknown;
  new_value: unknown;
  performed_by: string;
  timestamp: string;
};

type Team = { id: string; name: string };
type Agent = { id: string; name: string; email: string };

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

type TicketDetailResponse = {
  ticket: Ticket;
  events: TicketEvent[];
};

export const TicketDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [ticket, setTicket] = React.useState<Ticket | null>(null);
  const [events, setEvents] = React.useState<TicketEvent[]>([]);

  const [status, setStatus] = React.useState<TicketStatus>("OPEN");
  const [priority, setPriority] = React.useState<TicketPriority>("LOW");
  const [assignedTeam, setAssignedTeam] = React.useState<string | null>(null);
  const [assignedAgent, setAssignedAgent] = React.useState<string | null>(null);

  const [teams, setTeams] = React.useState<Team[]>([]);
  const [agents, setAgents] = React.useState<Agent[]>([]);

  const [comments, setComments] = React.useState<TicketComment[]>([]);
  const [replyBody, setReplyBody] = React.useState("");
  const [sendingReply, setSendingReply] = React.useState(false);

  const [internalNote, setInternalNote] = React.useState("");
  const [sendingInternalNote, setSendingInternalNote] = React.useState(false);

  const [error, setError] = React.useState("");
  const [success, setSuccess] = React.useState("");
  const [loading, setLoading] = React.useState(false);

  const load = React.useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError("");
    setSuccess("");
    try {
      const [detail, teamRes, agentRes] = await Promise.all([
        api.get<TicketDetailResponse>(`/tickets/${id}`),
        api.get<Team[]>("/teams"),
        api.get<Agent[]>("/users", { params: { role: "AGENT" } }),
      ]);

      const t = detail.data.ticket;
      setTicket(t);
      setEvents(detail.data.events || []);

      setStatus(t.status);
      setPriority(t.priority);
      setAssignedTeam(t.assigned_team);
      setAssignedAgent(t.assigned_agent);

      setTeams(teamRes.data || []);
      setAgents(agentRes.data || []);

      try {
        const commentRes = await api.get<TicketComment[]>(`/tickets/${id}/comments`);
        setComments(commentRes.data || []);
      } catch {
        setComments([]);
      }
    } catch (e: unknown) {
      setError(getApiErrorMessage(e, "Failed to load ticket"));
    } finally {
      setLoading(false);
    }
  }, [id]);

  React.useEffect(() => {
    void load();
  }, [load]);

  const applyChanges = async () => {
    if (!id) return;
    setError("");
    setSuccess("");
    try {
      // Priority is part of the model but not yet exposed by backend PATCH in this phase.
      // We still allow editing UI-side but only persist status/assignment.
      await api.patch(`/tickets/${id}/assign`, {
        assigned_team: assignedTeam,
        assigned_agent: assignedAgent,
      });
      await api.patch(`/tickets/${id}/status`, { status });

      setSuccess("Changes applied.");
      await load();
    } catch (e: unknown) {
      setError(getApiErrorMessage(e, "Failed to apply changes"));
    }
  };

  const sendReply = async () => {
    if (!id) return;
    const body = replyBody.trim();
    if (!body) return;
    setSendingReply(true);
    setError("");
    setSuccess("");
    try {
      await api.post(`/tickets/${id}/comments`, { body, is_internal: false });
      setReplyBody("");
      await load();
    } catch (e: unknown) {
      setError(getApiErrorMessage(e, "Failed to send reply"));
    } finally {
      setSendingReply(false);
    }
  };

  const sendInternalNote = async () => {
    if (!id) return;
    const body = internalNote.trim();
    if (!body) return;
    setSendingInternalNote(true);
    setError("");
    setSuccess("");
    try {
      await api.post(`/tickets/${id}/comments`, { body, is_internal: true });
      setInternalNote("");
      await load();
    } catch (e: unknown) {
      setError(getApiErrorMessage(e, "Failed to add internal note"));
    } finally {
      setSendingInternalNote(false);
    }
  };

  return (
    <Box>
      <Button startIcon={<ArrowBack />} sx={{ mb: 2 }} onClick={() => navigate("/admin/tickets")}>
        Back to Inbox
      </Button>

      <Typography variant="h4" gutterBottom>
        Ticket {id}
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {success && (
        <Alert severity="success" sx={{ mb: 2 }}>
          {success}
        </Alert>
      )}

      {loading && <Typography color="text.secondary">Loading...</Typography>}

      {ticket && (
        <TicketFlowVisualization
          ticketId={ticket.id}
          status={ticket.status}
          category={ticket.category}
          aiConfidence={ticket.ai_confidence}
          assignedTeam={ticket.assigned_team_name}
          assignedAgent={ticket.assigned_agent_name}
          sourceType={ticket.source_type || undefined}
        />
      )}

      <Grid container spacing={3}>
        <Grid item xs={12} md={8}>
          <Card sx={{ mb: 2 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Details
              </Typography>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6}>
                  <TextField fullWidth label="Subject" value={ticket?.title || ""} disabled />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField fullWidth label="Requester" value={ticket?.requester_email || ""} disabled />
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    multiline
                    rows={4}
                    label="Description"
                    value={ticket?.description || ""}
                    disabled
                  />
                </Grid>
              </Grid>
            </CardContent>
          </Card>

          <Card sx={{ mb: 2 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Conversation
              </Typography>

              {comments.length === 0 ? (
                <Typography color="text.secondary">No messages yet.</Typography>
              ) : (
                <List>
                  {comments.map((c, idx) => (
                    <React.Fragment key={c.id}>
                      <ListItem alignItems="flex-start">
                        <ListItemText
                          primary={
                            <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
                              <Typography component="span" fontWeight={600}>
                                {c.author_name}
                              </Typography>
                              <Typography component="span" variant="caption" color="text.secondary">
                                {c.author_email}
                              </Typography>
                              {c.is_internal ? (
                                <Chip size="small" color="warning" label="Internal" />
                              ) : (
                                <Chip size="small" color="info" label="Public" />
                              )}
                              <Typography component="span" variant="caption" color="text.secondary" sx={{ ml: "auto" }}>
                                {new Date(c.created_at).toLocaleString()}
                              </Typography>
                            </Box>
                          }
                          secondary={c.body}
                        />
                      </ListItem>
                      {idx < comments.length - 1 && <Divider />}
                    </React.Fragment>
                  ))}
                </List>
              )}

              <Divider sx={{ my: 2 }} />

              <Typography variant="subtitle1" gutterBottom>
                Reply to requester
              </Typography>
              <TextField
                fullWidth
                multiline
                minRows={3}
                label="Public reply"
                value={replyBody}
                onChange={(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setReplyBody(e.target.value)}
              />
              <Box sx={{ mt: 1, display: "flex", justifyContent: "flex-end" }}>
                <Button variant="contained" onClick={() => void sendReply()} disabled={sendingReply || !replyBody.trim()}>
                  Send Reply
                </Button>
              </Box>
            </CardContent>
          </Card>

          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                History
              </Typography>
              <List>
                {events.map((entry: TicketEvent, idx: number) => (
                  <React.Fragment key={entry.id}>
                    <ListItem>
                      <ListItemText
                        primary={entry.action}
                        secondary={JSON.stringify(entry.new_value ?? {})}
                      />
                      <Typography variant="caption" sx={{ ml: "auto" }}>
                        {new Date(entry.timestamp).toLocaleString()}
                      </Typography>
                    </ListItem>
                    {idx < events.length - 1 && <Divider />}
                  </React.Fragment>
                ))}
              </List>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Actions
              </Typography>
              <Grid container spacing={2} direction="column">
                <Grid item>
                  <FormControl fullWidth>
                    <InputLabel>Status</InputLabel>
                    <Select
                      value={status}
                      label="Status"
                      onChange={(e: SelectChangeEvent) =>
                        setStatus(e.target.value as TicketStatus)
                      }
                    >
                      <MenuItem value="OPEN">OPEN</MenuItem>
                      <MenuItem value="IN_PROGRESS">IN_PROGRESS</MenuItem>
                      <MenuItem value="RESOLVED">RESOLVED</MenuItem>
                      <MenuItem value="CLOSED">CLOSED</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item>
                  <FormControl fullWidth>
                    <InputLabel>Priority</InputLabel>
                    <Select
                      value={priority}
                      label="Priority"
                      onChange={(e: SelectChangeEvent) =>
                        setPriority(e.target.value as TicketPriority)
                      }
                    >
                      <MenuItem value="LOW">LOW</MenuItem>
                      <MenuItem value="MEDIUM">MEDIUM</MenuItem>
                      <MenuItem value="HIGH">HIGH</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item>
                  <FormControl fullWidth>
                    <InputLabel>Assigned Team</InputLabel>
                    <Select
                      value={assignedTeam || ""}
                      label="Assigned Team"
                      onChange={(e: SelectChangeEvent<string>) =>
                        setAssignedTeam(e.target.value ? e.target.value : null)
                      }
                    >
                      <MenuItem value="">Unassigned</MenuItem>
                      {teams.map((t: Team) => (
                        <MenuItem key={t.id} value={t.id}>
                          {t.name}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>

                <Grid item>
                  <FormControl fullWidth>
                    <InputLabel>Assigned Agent</InputLabel>
                    <Select
                      value={assignedAgent || ""}
                      label="Assigned Agent"
                      onChange={(e: SelectChangeEvent<string>) =>
                        setAssignedAgent(e.target.value ? e.target.value : null)
                      }
                    >
                      <MenuItem value="">Unassigned</MenuItem>
                      {agents.map((a: Agent) => (
                        <MenuItem key={a.id} value={a.id}>
                          {a.name} ({a.email})
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item>
                  <TextField
                    fullWidth
                    multiline
                    rows={3}
                    label="Internal Note"
                    value={internalNote}
                    onChange={(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
                      setInternalNote(e.target.value)
                    }
                  />
                  <Box sx={{ mt: 1, display: "flex", justifyContent: "flex-end" }}>
                    <Button
                      variant="outlined"
                      onClick={() => void sendInternalNote()}
                      disabled={sendingInternalNote || !internalNote.trim()}
                    >
                      Add Internal Note
                    </Button>
                  </Box>
                </Grid>
                <Grid item>
                  <Button
                    fullWidth
                    variant="contained"
                    startIcon={<Save />}
                    onClick={applyChanges}
                  >
                    Apply Changes
                  </Button>
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
};
