import React, { useState, useEffect } from "react";
import {
  Box,
  Typography,
  Paper,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Alert,
  Tabs,
  Tab,
  IconButton,
  Tooltip,
} from "@mui/material";
import {
  Add as AddIcon,
  Sync as SyncIcon,
  Delete as DeleteIcon,
  CheckCircle as ActiveIcon,
  Cancel as InactiveIcon,
  Email as EmailIcon,
  Cloud as GLPIIcon,
  Settings as SolmanIcon,
} from "@mui/icons-material";
import { api, getApiErrorMessage } from "../../services/api";

interface Integration {
  id: string;
  system_type: "EMAIL" | "GLPI" | "SOLMAN";
  name: string;
  enabled: boolean;
  config: any;
  last_sync?: string;
}

export const Integrations: React.FC = () => {
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedType, setSelectedType] = useState<"EMAIL" | "GLPI" | "SOLMAN">("EMAIL");
  const [formData, setFormData] = useState<any>({});

  useEffect(() => {
    loadIntegrations();
  }, []);

  const loadIntegrations = async () => {
    setLoading(true);
    setError("");
    try {
      // Load email sources
      const emailRes = await api.get("/integrations/email-sources");
      const emailIntegrations = emailRes.data.map((e: any) => ({
        ...e,
        system_type: "EMAIL" as const,
      }));

      // Load GLPI configs
      const glpiRes = await api.get("/integrations/glpi/configs");
      const glpiIntegrations = glpiRes.data.map((g: any) => ({
        ...g,
        system_type: "GLPI" as const,
      }));

      setIntegrations([...emailIntegrations, ...glpiIntegrations]);
    } catch (e: any) {
      setError(getApiErrorMessage(e, "Failed to load integrations"));
    } finally {
      setLoading(false);
    }
  };

  const handleSync = async (integration: Integration) => {
    try {
      if (integration.system_type === "GLPI") {
        await api.post(`/integrations/glpi/sync/${integration.id}`);
        alert("GLPI sync initiated");
      } else if (integration.system_type === "EMAIL") {
        await api.post(`/integrations/email-sources/${integration.id}/check`);
        alert("Email check initiated");
      }
      loadIntegrations();
    } catch (e: any) {
      alert(getApiErrorMessage(e, "Sync failed"));
    }
  };

  const handleDelete = async (id: string, type: string) => {
    if (!confirm("Are you sure you want to delete this integration?")) return;

    try {
      if (type === "EMAIL") {
        await api.delete(`/integrations/email-sources/${id}`);
      } else if (type === "GLPI") {
        await api.delete(`/integrations/glpi/configs/${id}`);
      }
      loadIntegrations();
    } catch (e: any) {
      alert(getApiErrorMessage(e, "Delete failed"));
    }
  };

  const handleCreate = async () => {
    try {
      if (selectedType === "EMAIL") {
        await api.post("/integrations/email-sources", formData);
      } else if (selectedType === "GLPI") {
        await api.post("/integrations/glpi/configs", formData);
      }
      setDialogOpen(false);
      setFormData({});
      loadIntegrations();
    } catch (e: any) {
      alert(getApiErrorMessage(e, "Creation failed"));
    }
  };

  const getIcon = (type: string) => {
    switch (type) {
      case "EMAIL":
        return <EmailIcon />;
      case "GLPI":
        return <GLPIIcon />;
      case "SOLMAN":
        return <SolmanIcon />;
      default:
        return null;
    }
  };

  return (
    <Box>
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 3 }}>
        <Typography variant="h4" gutterBottom>
          System Integrations
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => {
            setFormData({});
            setDialogOpen(true);
          }}
        >
          Add Integration
        </Button>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <Paper>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Type</TableCell>
                <TableCell>Name</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Last Sync</TableCell>
                <TableCell>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {integrations.length === 0 && !loading && (
                <TableRow>
                  <TableCell colSpan={5} align="center">
                    <Typography color="text.secondary" sx={{ py: 4 }}>
                      No integrations configured. Click "Add Integration" to get started.
                    </Typography>
                  </TableCell>
                </TableRow>
              )}
              {integrations.map((integration) => (
                <TableRow key={integration.id}>
                  <TableCell>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                      {getIcon(integration.system_type)}
                      <Typography>{integration.system_type}</Typography>
                    </Box>
                  </TableCell>
                  <TableCell>{integration.name || integration.config?.name || "Unnamed"}</TableCell>
                  <TableCell>
                    <Chip
                      icon={integration.enabled ? <ActiveIcon /> : <InactiveIcon />}
                      label={integration.enabled ? "Active" : "Inactive"}
                      color={integration.enabled ? "success" : "default"}
                      size="small"
                    />
                  </TableCell>
                  <TableCell>
                    {integration.last_sync
                      ? new Date(integration.last_sync).toLocaleString()
                      : "Never"}
                  </TableCell>
                  <TableCell>
                    <Box sx={{ display: "flex", gap: 1 }}>
                      <Tooltip title="Sync Now">
                        <IconButton
                          size="small"
                          onClick={() => handleSync(integration)}
                          color="primary"
                        >
                          <SyncIcon />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Delete">
                        <IconButton
                          size="small"
                          onClick={() => handleDelete(integration.id, integration.system_type)}
                          color="error"
                        >
                          <DeleteIcon />
                        </IconButton>
                      </Tooltip>
                    </Box>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      {/* Create Dialog */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>Add Integration</DialogTitle>
        <DialogContent>
          <Tabs
            value={selectedType}
            onChange={(_, v) => setSelectedType(v)}
            sx={{ mb: 3 }}
          >
            <Tab label="Email" value="EMAIL" icon={<EmailIcon />} iconPosition="start" />
            <Tab label="GLPI" value="GLPI" icon={<GLPIIcon />} iconPosition="start" />
            <Tab label="Solman" value="SOLMAN" icon={<SolmanIcon />} iconPosition="start" disabled />
          </Tabs>

          {selectedType === "EMAIL" && (
            <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
              <TextField
                label="Name"
                value={formData.name || ""}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                fullWidth
              />
              <TextField
                label="IMAP Host"
                value={formData.imapHost || ""}
                onChange={(e) => setFormData({ ...formData, imapHost: e.target.value })}
                fullWidth
              />
              <TextField
                label="IMAP Port"
                type="number"
                value={formData.imapPort || ""}
                onChange={(e) => setFormData({ ...formData, imapPort: parseInt(e.target.value) })}
                fullWidth
              />
              <TextField
                label="Email"
                type="email"
                value={formData.email || ""}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                fullWidth
              />
              <TextField
                label="Password"
                type="password"
                value={formData.password || ""}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                fullWidth
              />
            </Box>
          )}

          {selectedType === "GLPI" && (
            <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
              <TextField
                label="Name"
                value={formData.name || ""}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                fullWidth
              />
              <TextField
                label="API URL"
                value={formData.apiUrl || ""}
                onChange={(e) => setFormData({ ...formData, apiUrl: e.target.value })}
                fullWidth
                placeholder="https://glpi.example.com/apirest.php"
              />
              <TextField
                label="App Token"
                value={formData.appToken || ""}
                onChange={(e) => setFormData({ ...formData, appToken: e.target.value })}
                fullWidth
              />
              <TextField
                label="User Token"
                value={formData.userToken || ""}
                onChange={(e) => setFormData({ ...formData, userToken: e.target.value })}
                fullWidth
              />
            </Box>
          )}

          {selectedType === "SOLMAN" && (
            <Alert severity="info">
              Solman integration configuration coming soon. Use API endpoints for now.
            </Alert>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleCreate} variant="contained" disabled={selectedType === "SOLMAN"}>
            Create
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};
