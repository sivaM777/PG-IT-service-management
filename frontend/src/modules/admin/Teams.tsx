import React from "react";
import {
  Box,
  Typography,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Alert,
} from "@mui/material";
import { Add, Edit, Delete } from "@mui/icons-material";
import { api, getApiErrorMessage } from "../../services/api";

type TeamRow = {
  id: string;
  name: string;
  created_at: string;
};

export const Teams: React.FC = () => {
  const [teams, setTeams] = React.useState<TeamRow[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState("");

  const [open, setOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<TeamRow | null>(null);
  const [name, setName] = React.useState("");

  const load = React.useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await api.get<TeamRow[]>("/teams");
      setTeams(res.data || []);
    } catch (e: unknown) {
      setError(getApiErrorMessage(e, "Failed to load teams"));
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void load();
  }, [load]);

  const openCreate = () => {
    setEditing(null);
    setName("");
    setOpen(true);
  };

  const openEdit = (t: TeamRow) => {
    setEditing(t);
    setName(t.name);
    setOpen(true);
  };

  const close = () => {
    setOpen(false);
    setEditing(null);
  };

  const save = async () => {
    setError("");
    try {
      if (editing) {
        await api.patch(`/teams/${editing.id}`, { name: name.trim() });
      } else {
        await api.post("/teams", { name: name.trim() });
      }
      close();
      await load();
    } catch (e: unknown) {
      setError(getApiErrorMessage(e, "Failed to save team"));
    }
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this team?")) return;
    setError("");
    try {
      await api.delete(`/teams/${id}`);
      await load();
    } catch (e: unknown) {
      setError(getApiErrorMessage(e, "Failed to delete team"));
    }
  };

  return (
    <Box>
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 3 }}>
        <Typography variant="h4">Teams</Typography>
        <Button variant="contained" startIcon={<Add />} onClick={openCreate}>
          Add Team
        </Button>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError("")}>
          {error}
        </Alert>
      )}

      {loading && <Typography color="text.secondary">Loading...</Typography>}

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Name</TableCell>
              <TableCell>Created</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {!loading && teams.length === 0 && (
              <TableRow>
                <TableCell colSpan={3}>
                  <Typography color="text.secondary">No teams found.</Typography>
                </TableCell>
              </TableRow>
            )}
            {teams.map((t) => (
              <TableRow key={t.id}>
                <TableCell>{t.name}</TableCell>
                <TableCell>{new Date(t.created_at).toLocaleString()}</TableCell>
                <TableCell align="right">
                  <IconButton size="small" onClick={() => openEdit(t)}>
                    <Edit />
                  </IconButton>
                  <IconButton size="small" color="error" onClick={() => void remove(t.id)}>
                    <Delete />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      <Dialog open={open} onClose={close} fullWidth maxWidth="sm">
        <DialogTitle>{editing ? "Edit Team" : "Create Team"}</DialogTitle>
        <DialogContent>
          <Box sx={{ display: "flex", flexDirection: "column", gap: 2, pt: 2 }}>
            <TextField
              label="Team Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              fullWidth
              required
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={close}>Cancel</Button>
          <Button onClick={() => void save()} variant="contained" disabled={!name.trim()}>
            Save
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};
