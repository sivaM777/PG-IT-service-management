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
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert,
} from "@mui/material";
import { Add, Edit, Delete } from "@mui/icons-material";
import { api, getApiErrorMessage } from "../../services/api";

type UserRole = "EMPLOYEE" | "AGENT" | "ADMIN";

type UserRow = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  team_id: string | null;
  created_at: string;
};

type TeamRow = {
  id: string;
  name: string;
  created_at: string;
};

export const Users: React.FC = () => {
  const [users, setUsers] = React.useState<UserRow[]>([]);
  const [teams, setTeams] = React.useState<TeamRow[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState("");

  const [open, setOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<UserRow | null>(null);

  const [form, setForm] = React.useState({
    name: "",
    email: "",
    role: "EMPLOYEE" as UserRole,
    team_id: "",
    password: "",
  });

  const load = React.useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [uRes, tRes] = await Promise.all([
        api.get<UserRow[]>("/users"),
        api.get<TeamRow[]>("/teams"),
      ]);
      setUsers(uRes.data || []);
      setTeams(tRes.data || []);
    } catch (e: unknown) {
      setError(getApiErrorMessage(e, "Failed to load users"));
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void load();
  }, [load]);

  const teamName = (teamId: string | null) => {
    if (!teamId) return "-";
    return teams.find((t) => t.id === teamId)?.name ?? "-";
  };

  const openCreate = () => {
    setEditing(null);
    setForm({ name: "", email: "", role: "EMPLOYEE", team_id: "", password: "" });
    setOpen(true);
  };

  const openEdit = (u: UserRow) => {
    setEditing(u);
    setForm({
      name: u.name,
      email: u.email,
      role: u.role,
      team_id: u.team_id ?? "",
      password: "",
    });
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
        const payload: Record<string, unknown> = {};
        if (form.name.trim() && form.name.trim() !== editing.name) payload.name = form.name.trim();
        if (form.email.trim() && form.email.trim() !== editing.email) payload.email = form.email.trim();
        if (form.role !== editing.role) payload.role = form.role;
        if ((form.team_id || null) !== (editing.team_id || null)) payload.team_id = form.team_id ? form.team_id : null;
        if (form.password.trim()) payload.password = form.password.trim();

        await api.patch(`/users/${editing.id}`, payload);
      } else {
        await api.post("/users", {
          name: form.name.trim(),
          email: form.email.trim(),
          role: form.role,
          team_id: form.team_id ? form.team_id : null,
          password: form.password,
        });
      }

      close();
      await load();
    } catch (e: unknown) {
      setError(getApiErrorMessage(e, "Failed to save user"));
    }
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this user?")) return;
    setError("");
    try {
      await api.delete(`/users/${id}`);
      await load();
    } catch (e: unknown) {
      setError(getApiErrorMessage(e, "Failed to delete user"));
    }
  };

  return (
    <Box>
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 3 }}>
        <Typography variant="h4">Users</Typography>
        <Button variant="contained" startIcon={<Add />} onClick={openCreate}>
          Add User
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
              <TableCell>Email</TableCell>
              <TableCell>Role</TableCell>
              <TableCell>Team</TableCell>
              <TableCell>Created</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {!loading && users.length === 0 && (
              <TableRow>
                <TableCell colSpan={6}>
                  <Typography color="text.secondary">No users found.</Typography>
                </TableCell>
              </TableRow>
            )}
            {users.map((u) => (
              <TableRow key={u.id}>
                <TableCell>{u.name}</TableCell>
                <TableCell>{u.email}</TableCell>
                <TableCell>{u.role}</TableCell>
                <TableCell>{teamName(u.team_id)}</TableCell>
                <TableCell>{new Date(u.created_at).toLocaleString()}</TableCell>
                <TableCell align="right">
                  <IconButton size="small" onClick={() => openEdit(u)}>
                    <Edit />
                  </IconButton>
                  <IconButton size="small" color="error" onClick={() => void remove(u.id)}>
                    <Delete />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      <Dialog open={open} onClose={close} fullWidth maxWidth="sm">
        <DialogTitle>{editing ? "Edit User" : "Create User"}</DialogTitle>
        <DialogContent>
          <Box sx={{ display: "flex", flexDirection: "column", gap: 2, pt: 2 }}>
            <TextField
              label="Name"
              value={form.name}
              onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
              fullWidth
              required
            />
            <TextField
              label="Email"
              value={form.email}
              onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
              fullWidth
              required
            />
            <FormControl fullWidth>
              <InputLabel>Role</InputLabel>
              <Select
                value={form.role}
                label="Role"
                onChange={(e) => setForm((p) => ({ ...p, role: e.target.value as UserRole }))}
              >
                <MenuItem value="EMPLOYEE">EMPLOYEE</MenuItem>
                <MenuItem value="AGENT">AGENT</MenuItem>
                <MenuItem value="ADMIN">ADMIN</MenuItem>
              </Select>
            </FormControl>
            <FormControl fullWidth>
              <InputLabel>Team</InputLabel>
              <Select
                value={form.team_id}
                label="Team"
                onChange={(e) => setForm((p) => ({ ...p, team_id: e.target.value }))}
              >
                <MenuItem value="">None</MenuItem>
                {teams.map((t) => (
                  <MenuItem key={t.id} value={t.id}>
                    {t.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <TextField
              label={editing ? "New password (optional)" : "Password"}
              type="password"
              value={form.password}
              onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))}
              fullWidth
              required={!editing}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={close}>Cancel</Button>
          <Button
            onClick={() => void save()}
            variant="contained"
            disabled={!form.name.trim() || !form.email.trim() || (!editing && !form.password.trim())}
          >
            Save
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};
