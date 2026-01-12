import React from "react";
import {
  Box,
  Typography,
  Grid,
  Card,
  CardContent,
  Alert,
  Paper,
} from "@mui/material";
import {
  Assignment as TicketIcon,
  TrendingUp as TrendingIcon,
  Speed as SpeedIcon,
  CheckCircle as ResolvedIcon,
} from "@mui/icons-material";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { api, getApiErrorMessage } from "../../services/api";

type Ticket = {
  id: string;
  status: "OPEN" | "IN_PROGRESS" | "RESOLVED" | "CLOSED";
  priority: "LOW" | "MEDIUM" | "HIGH";
  created_at: string;
  resolved_at: string | null;
  category: string | null;
};

export const Dashboard: React.FC = () => {
  const [tickets, setTickets] = React.useState<Ticket[]>([]);
  const [error, setError] = React.useState("");
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    (async () => {
      setLoading(true);
      setError("");
      try {
        const res = await api.get<Ticket[]>("/tickets");
        setTickets(res.data);
      } catch (e: unknown) {
        setError(getApiErrorMessage(e, "Failed to load dashboard metrics"));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const total = tickets.length;
  const open = tickets.filter((t: Ticket) => t.status === "OPEN").length;
  const inProgress = tickets.filter((t: Ticket) => t.status === "IN_PROGRESS").length;
  const resolved = tickets.filter((t: Ticket) => t.status === "RESOLVED" || t.status === "CLOSED").length;
  const highPriority = tickets.filter((t: Ticket) => t.priority === "HIGH").length;

  // Calculate average resolution time (in hours)
  const resolvedTickets = tickets.filter((t: Ticket) => t.resolved_at);
  const avgResolutionTime = resolvedTickets.length > 0
    ? resolvedTickets.reduce((acc, t) => {
        if (t.resolved_at && t.created_at) {
          const created = new Date(t.created_at).getTime();
          const resolved = new Date(t.resolved_at).getTime();
          return acc + (resolved - created) / (1000 * 60 * 60); // Convert to hours
        }
        return acc;
      }, 0) / resolvedTickets.length
    : 0;

  // Category distribution
  const categoryCounts: Record<string, number> = {};
  tickets.forEach((t: Ticket) => {
    const cat = t.category || "Uncategorized";
    categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;
  });
  const categoryData = Object.entries(categoryCounts).map(([name, value]) => ({ name, value }));

  // Status distribution
  const statusData = [
    { name: "Open", value: open },
    { name: "In Progress", value: inProgress },
    { name: "Resolved", value: resolved },
  ];

  // Priority distribution
  const priorityData = [
    { name: "High", value: highPriority },
    { name: "Medium", value: tickets.filter((t: Ticket) => t.priority === "MEDIUM").length },
    { name: "Low", value: tickets.filter((t: Ticket) => t.priority === "LOW").length },
  ];

  const kpiCards = [
    {
      label: "Total Tickets",
      value: total,
      icon: TicketIcon,
      color: "#1976d2",
    },
    {
      label: "Open Tickets",
      value: open,
      icon: TicketIcon,
      color: "#d32f2f",
    },
    {
      label: "Resolved",
      value: resolved,
      icon: ResolvedIcon,
      color: "#2e7d32",
    },
    {
      label: "Avg Resolution",
      value: `${avgResolutionTime.toFixed(1)}h`,
      icon: SpeedIcon,
      color: "#ed6c02",
    },
    {
      label: "High Priority",
      value: highPriority,
      icon: TrendingIcon,
      color: "#d32f2f",
    },
  ];

  return (
    <Box>
      <Typography variant="h4" gutterBottom sx={{ fontWeight: 600, mb: 4 }}>
        Admin Dashboard
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {loading && <Typography color="text.secondary">Loading...</Typography>}

      {/* KPI Cards */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        {kpiCards.map((kpi) => {
          const Icon = kpi.icon;
          return (
            <Grid item xs={12} sm={6} md={4} lg={2.4} key={kpi.label}>
              <Card
                sx={{
                  background: `linear-gradient(135deg, ${kpi.color}15 0%, ${kpi.color}05 100%)`,
                  border: `1px solid ${kpi.color}30`,
                  transition: "transform 0.2s, box-shadow 0.2s",
                  "&:hover": {
                    transform: "translateY(-4px)",
                    boxShadow: 4,
                  },
                }}
              >
                <CardContent>
                  <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <Box>
                      <Typography color="textSecondary" gutterBottom variant="body2" sx={{ fontWeight: 500 }}>
                        {kpi.label}
                      </Typography>
                      <Typography variant="h4" sx={{ fontWeight: 700, color: kpi.color }}>
                        {kpi.value}
                      </Typography>
                    </Box>
                    <Box
                      sx={{
                        width: 56,
                        height: 56,
                        borderRadius: "50%",
                        bgcolor: `${kpi.color}20`,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <Icon sx={{ fontSize: 28, color: kpi.color }} />
                    </Box>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          );
        })}
      </Grid>

      {/* Charts */}
      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom sx={{ fontWeight: 600 }}>
              Tickets by Status
            </Typography>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={statusData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="value" fill="#1976d2" />
              </BarChart>
            </ResponsiveContainer>
          </Paper>
        </Grid>

        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom sx={{ fontWeight: 600 }}>
              Tickets by Priority
            </Typography>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={priorityData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="value" fill="#ed6c02" />
              </BarChart>
            </ResponsiveContainer>
          </Paper>
        </Grid>

        {categoryData.length > 0 && (
          <Grid item xs={12}>
            <Paper sx={{ p: 3 }}>
              <Typography variant="h6" gutterBottom sx={{ fontWeight: 600 }}>
                Tickets by Category (AI Classification)
              </Typography>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={categoryData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" />
                  <YAxis dataKey="name" type="category" width={150} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="value" fill="#667eea" />
                </BarChart>
              </ResponsiveContainer>
            </Paper>
          </Grid>
        )}
      </Grid>
    </Box>
  );
};
