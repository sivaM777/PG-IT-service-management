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
  Alert,
} from "@mui/material";
import { Visibility } from "@mui/icons-material";
import { api, getApiErrorMessage } from "../../services/api";

type Ticket = {
  id: string;
  title: string;
  status: "OPEN" | "IN_PROGRESS" | "RESOLVED" | "CLOSED";
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

export const MyTickets: React.FC = () => {
  const navigate = useNavigate();
  const [tickets, setTickets] = React.useState<Ticket[]>([]);
  const [error, setError] = React.useState("");
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    (async () => {
      setLoading(true);
      setError("");
      try {
        const res = await api.get<Ticket[]>("/tickets/my");
        setTickets(res.data);
      } catch (e: unknown) {
        setError(getApiErrorMessage(e, "Failed to load tickets"));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        My Tickets
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {loading && <Typography color="text.secondary">Loading...</Typography>}

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Ticket ID</TableCell>
              <TableCell>Subject</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Last Updated</TableCell>
              <TableCell></TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {!loading && tickets.length === 0 && (
              <TableRow>
                <TableCell colSpan={5}>
                  <Typography color="text.secondary">No tickets yet.</Typography>
                </TableCell>
              </TableRow>
            )}
            {tickets.map((ticket: Ticket) => (
              <TableRow key={ticket.id}>
                <TableCell>{ticket.id}</TableCell>
                <TableCell>{ticket.title}</TableCell>
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
                    onClick={() => navigate(`/app/tickets/${ticket.id}`)}
                  >
                    View
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
