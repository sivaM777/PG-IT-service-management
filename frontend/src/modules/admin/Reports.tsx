import React from "react";
import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  List,
  ListItem,
  ListItemText,
  Paper,
} from "@mui/material";

const weeklySummary = [
  { label: "Tickets created", value: 24 },
  { label: "Tickets resolved", value: 19 },
  { label: "Escalations", value: 3 },
  { label: "Top category", value: "Network" },
];

const recentActivity = [
  { event: "Ticket TKT-260108-34001 created", time: "2 min ago" },
  { event: "Ticket TKT-260107-33012 resolved", time: "15 min ago" },
  { event: "Ticket TKT-260107-33010 assigned", time: "32 min ago" },
  { event: "KB article KB-004 updated", time: "1 hour ago" },
];

export const Reports: React.FC = () => {
  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Reports
      </Typography>

      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Weekly Summary
              </Typography>
              <List>
                {weeklySummary.map((item, idx) => (
                  <ListItem key={idx}>
                    <ListItemText
                      primary={item.label}
                      secondary={item.value}
                      primaryTypographyProps={{ fontWeight: "bold" }}
                    />
                  </ListItem>
                ))}
              </List>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Recent Activity
              </Typography>
              <List dense>
                {recentActivity.map((item, idx) => (
                  <ListItem key={idx}>
                    <ListItemText primary={item.event} secondary={item.time} />
                  </ListItem>
                ))}
              </List>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Paper sx={{ p: 2, mt: 3 }}>
        <Typography variant="h6" gutterBottom>
          Notes
        </Typography>
        <Typography variant="body2" color="text.secondary">
          This is a placeholder Reports view. In a full implementation, you would see:
          <ul>
            <li>Ticket volume trends</li>
            <li>SLA compliance metrics</li>
            <li>Team performance dashboards</li>
            <li>Exportable CSV/PDF reports</li>
          </ul>
        </Typography>
      </Paper>
    </Box>
  );
};
