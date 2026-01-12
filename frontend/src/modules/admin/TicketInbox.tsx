import React from "react";
import { useNavigate } from "react-router-dom";
import {
  Box,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  ChipProps,
  Button,
  Select,
  SelectChangeEvent,
  MenuItem,
  FormControl,
  InputLabel,
  Alert,
} from "@mui/material";
import { Visibility, Edit } from "@mui/icons-material";
import { api, getApiErrorMessage } from "../../services/api";
import { useAuth } from "../../services/auth";

type Ticket = {
  id: string;
  title: string;
  requester_email: string;
  status: "OPEN" | "IN_PROGRESS" | "RESOLVED" | "CLOSED";
  priority: "LOW" | "MEDIUM" | "HIGH";
  assigned_team_name: string | null;
  assigned_agent: string | null;
  assigned_agent_name: string | null;
  updated_at: string;
};

const statusColor = (status: Ticket["status"]): ChipProps["color"] => {
  switch (status) {
    case "OPEN":
      return "error";
    case "IN_PROGRESS":
      return "warning";
    case "RESOLVED":
      return "success";
    default:
      return "default";
  }
};

const priorityRank: Record<Ticket["priority"], number> = {
  HIGH: 3,
  MEDIUM: 2,
  LOW: 1,
};

export const TicketInbox: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [filterStatus, setFilterStatus] = React.useState("All");
  const [tickets, setTickets] = React.useState<Ticket[]>([]);
  const [error, setError] = React.useState("");
  const [loading, setLoading] = React.useState(false);

  const load = React.useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await api.get<Ticket[]>("/tickets");
      setTickets(res.data);
    } catch (e: unknown) {
      setError(getApiErrorMessage(e, "Failed to load ticket inbox"));
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    (async () => {
      await load();
    })();
  }, [load]);

  const claimTicket = async (ticketId: string) => {
    if (!user?.id) return;
    setError("");
    try {
      await api.patch(`/tickets/${ticketId}/assign`, {
        assigned_agent: user.id,
      });
      await load();
    } catch (e: unknown) {
      setError(getApiErrorMessage(e, "Failed to claim ticket"));
    }
  };

  const filtered = tickets
    .filter((t: Ticket) => (filterStatus === "All" ? true : t.status === filterStatus))
    .sort((a: Ticket, b: Ticket) => priorityRank[b.priority] - priorityRank[a.priority]);

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Ticket Inbox
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {loading && <Typography color="text.secondary">Loading...</Typography>}

      <Box sx={{ mb: 2, display: "flex", alignItems: "center", gap: 2 }}>
        <FormControl size="small" sx={{ minWidth: 140 }}>
          <InputLabel>Status</InputLabel>
          <Select
            value={filterStatus}
            label="Status"
            onChange={(e: SelectChangeEvent) => setFilterStatus(e.target.value)}
          >
            <MenuItem value="All">All</MenuItem>
            <MenuItem value="OPEN">OPEN</MenuItem>
            <MenuItem value="IN_PROGRESS">IN_PROGRESS</MenuItem>
            <MenuItem value="RESOLVED">RESOLVED</MenuItem>
            <MenuItem value="CLOSED">CLOSED</MenuItem>
          </Select>
        </FormControl>
      </Box>

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Ticket ID</TableCell>
              <TableCell>Subject</TableCell>
              <TableCell>Requester</TableCell>
              <TableCell>Assigned Team</TableCell>
              <TableCell>Assigned Agent</TableCell>
              <TableCell>Priority</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Updated</TableCell>
              <TableCell></TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {!loading && filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={8}>
                  <Typography color="text.secondary">No tickets found.</Typography>
                </TableCell>
              </TableRow>
            )}
            {filtered.map((ticket: Ticket) => (
              <TableRow key={ticket.id}>
                <TableCell>{ticket.id}</TableCell>
                <TableCell>{ticket.title}</TableCell>
                <TableCell>{ticket.requester_email}</TableCell>
                <TableCell>{ticket.assigned_team_name ?? "-"}</TableCell>
                <TableCell>{ticket.assigned_agent_name ?? "-"}</TableCell>
                <TableCell>{ticket.priority}</TableCell>
                <TableCell>
                  <Chip
                    label={ticket.status}
                    color={statusColor(ticket.status)}
                    size="small"
                  />
                </TableCell>
                <TableCell>
                  {new Date(ticket.updated_at).toLocaleString()}
                </TableCell>
                <TableCell>
                  <Button
                    size="small"
                    variant="outlined"
                    startIcon={<Visibility />}
                    sx={{ mr: 1 }}
                    onClick={() => navigate(`/admin/tickets/${ticket.id}`)}
                  >
                    View
                  </Button>
                  <Button
                    size="small"
                    variant="contained"
                    sx={{ mr: 1 }}
                    disabled={!user?.id || Boolean(ticket.assigned_agent)}
                    onClick={() => void claimTicket(ticket.id)}
                  >
                    Claim
                  </Button>
                  <Button size="small" variant="text" startIcon={<Edit />} disabled>
                    Edit
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
};
