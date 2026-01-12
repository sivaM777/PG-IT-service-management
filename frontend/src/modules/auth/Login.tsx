import React from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  Box,
  Paper,
  Stack,
  TextField,
  Button,
  Typography,
  Alert,
  Container,
  Divider,
} from "@mui/material";
import { useAuth } from "../../services/auth";
import { getApiErrorMessage } from "../../services/api";

export const Login: React.FC = () => {
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [error, setError] = React.useState("");
  const [emailError, setEmailError] = React.useState<string | null>(null);
  const [passwordError, setPasswordError] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  type LocationState = { from?: { pathname?: string } };
  const state = location.state as LocationState | null;
  const from = state?.from?.pathname || "/";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setEmailError(null);
    setPasswordError(null);

    const trimmedEmail = email.trim();
    const nextEmailError = !trimmedEmail
      ? "Email is required"
      : /^\S+@\S+\.\S+$/.test(trimmedEmail)
        ? null
        : "Enter a valid email";
    const nextPasswordError = password ? null : "Password is required";
    if (nextEmailError || nextPasswordError) {
      setEmailError(nextEmailError);
      setPasswordError(nextPasswordError);
      return;
    }

    setSubmitting(true);
    try {
      await login(trimmedEmail, password);
      navigate(from, { replace: true });
    } catch (err: unknown) {
      setError(getApiErrorMessage(err, "Invalid email or password"));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Box
      sx={{
        height: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "linear-gradient(135deg, #0b1220 0%, #111a2e 40%, #0b1220 100%)",
      }}
    >
      <Container maxWidth="sm">
        <Paper elevation={8} sx={{ p: { xs: 3, sm: 4 }, borderRadius: 3 }}>
          <Stack spacing={2.5}>
            <Stack spacing={0.5}>
              <Typography variant="h4" sx={{ fontWeight: 700 }}>
                PG-IT Service Portal
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Sign in to manage and track IT requests.
              </Typography>
            </Stack>

            {error && <Alert severity="error">{error}</Alert>}

            <Box component="form" onSubmit={handleSubmit} noValidate>
              <Stack spacing={2}>
                <TextField
                  required
                  fullWidth
                  label="Email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  error={!!emailError}
                  helperText={emailError ?? ""}
                  onChange={(e) => setEmail(e.target.value)}
                />
                <TextField
                  required
                  fullWidth
                  label="Password"
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  error={!!passwordError}
                  helperText={passwordError ?? ""}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <Button type="submit" fullWidth variant="contained" size="large" disabled={submitting}>
                  {submitting ? "Signing in..." : "Sign In"}
                </Button>
              </Stack>
            </Box>

            <Divider />

            <Stack spacing={1}>
              <Typography variant="caption" color="text.secondary">
                Demo credentials
              </Typography>
              <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
                <Button
                  variant="outlined"
                  size="small"
                  onClick={() => {
                    setEmail("admin@company.com");
                    setPassword("admin123");
                  }}
                >
                  Use Admin
                </Button>
                <Button
                  variant="outlined"
                  size="small"
                  onClick={() => {
                    setEmail("agent@company.com");
                    setPassword("agent123");
                  }}
                >
                  Use Agent
                </Button>
                <Button
                  variant="outlined"
                  size="small"
                  onClick={() => {
                    setEmail("employee@company.com");
                    setPassword("employee123");
                  }}
                >
                  Use Employee
                </Button>
              </Stack>
            </Stack>
          </Stack>
        </Paper>
      </Container>
    </Box>
  );
};
