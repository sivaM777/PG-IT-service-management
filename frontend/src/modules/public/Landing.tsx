import React from "react";
import { Navigate, Link as RouterLink, useNavigate } from "react-router-dom";
import {
  AppBar,
  Box,
  Button,
  Card,
  CardContent,
  Container,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Fade,
  Grid,
  Stack,
  Toolbar,
  Typography,
  Chip,
  Divider,
  Grow,
} from "@mui/material";
import {
  AutoAwesome,
  Shield,
  Speed,
  SupportAgent,
  CheckCircle,
} from "@mui/icons-material";
import { useAuth } from "../../services/auth";
import { usePwaInstallPrompt } from "../../utils/usePwaInstallPrompt";

export const Landing: React.FC = () => {
  const { isAuthenticated, user } = useAuth();
  const navigate = useNavigate();
  const { isInstallable, isInstalled, promptInstall } = usePwaInstallPrompt();
  const [mounted, setMounted] = React.useState(false);
  const [installOpen, setInstallOpen] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  const apkUrl = (import.meta as any)?.env?.VITE_ANDROID_APK_URL as string | undefined;
  const isHttpsOrLocalhost =
    window.location.protocol === "https:" || window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
  const ua = navigator.userAgent || "";
  const isIos = /iphone|ipad|ipod/i.test(ua);
  const isAndroid = /android/i.test(ua);

  const onInstallClick = async () => {
    if (isInstalled) {
      navigate("/login");
      return;
    }
    if (isInstallable) {
      await promptInstall();
      return;
    }
    setInstallOpen(true);
  };

  if (isAuthenticated) {
    const target = user?.role === "ADMIN" || user?.role === "AGENT" ? "/admin" : "/app";
    return <Navigate to={target} replace />;
  }

  return (
    <Box
      sx={{
        minHeight: "100vh",
        color: "white",
        overflow: "hidden",
        background:
          "radial-gradient(1200px 600px at 15% 10%, rgba(37, 99, 235, 0.35), transparent 60%), radial-gradient(900px 520px at 90% 25%, rgba(147, 197, 253, 0.22), transparent 55%), linear-gradient(135deg, #070B12 0%, #0B1C2D 55%, #070B12 100%)",
        backgroundSize: "200% 200%",
        animation: "bgShift 18s ease-in-out infinite",
        "@keyframes bgShift": {
          "0%": { backgroundPosition: "0% 0%" },
          "50%": { backgroundPosition: "100% 100%" },
          "100%": { backgroundPosition: "0% 0%" },
        },
        "&::before": {
          content: '""',
          position: "absolute",
          inset: "-20% -20% auto -20%",
          height: 520,
          background:
            "radial-gradient(circle at 30% 30%, rgba(147, 197, 253, 0.28), transparent 55%), radial-gradient(circle at 70% 40%, rgba(37, 99, 235, 0.22), transparent 60%)",
          filter: "blur(28px)",
          transform: "translate3d(0,0,0)",
          animation: "blobFloat 14s ease-in-out infinite",
          pointerEvents: "none",
        },
        "@keyframes blobFloat": {
          "0%": { transform: "translate3d(0px, 0px, 0)" },
          "50%": { transform: "translate3d(40px, 28px, 0)" },
          "100%": { transform: "translate3d(0px, 0px, 0)" },
        },
      }}
    >
      <AppBar position="sticky" elevation={0} sx={{ bgcolor: "transparent" }}>
        <Toolbar sx={{ justifyContent: "space-between" }}>
          <Stack direction="row" alignItems="center" spacing={1.5}>
            <Box
              component="img"
              src="/icons/icon-192.svg"
              alt="PG-IT"
              sx={{ width: 28, height: 28 }}
            />
            <Typography variant="subtitle1" sx={{ fontWeight: 700, letterSpacing: 0.2 }}>
              PG-IT Service Portal
            </Typography>
            <Chip
              size="small"
              label="Enterprise"
              sx={{ bgcolor: "rgba(255,255,255,0.12)", color: "white" }}
            />
          </Stack>

          <Stack direction="row" spacing={1} alignItems="center">
            <Button
              color="inherit"
              variant="outlined"
              size="small"
              onClick={() => void onInstallClick()}
              sx={{ borderColor: "rgba(255,255,255,0.45)" }}
            >
              {isInstalled ? "Open" : "Install"}
            </Button>
            <Button color="inherit" component={RouterLink} to="/login" variant="outlined" size="small">
              Sign in
            </Button>
            <Button
              variant="contained"
              size="small"
              onClick={() => navigate("/login")}
              sx={{
                bgcolor: "#2563eb",
                transition: "transform 160ms ease, box-shadow 160ms ease",
                boxShadow: "0 10px 30px rgba(37, 99, 235, 0.24)",
                "&:hover": {
                  bgcolor: "#1d4ed8",
                  transform: "translateY(-1px)",
                  boxShadow: "0 14px 38px rgba(37, 99, 235, 0.34)",
                },
              }}
            >
              Get started
            </Button>
          </Stack>
        </Toolbar>
      </AppBar>

      <Container sx={{ py: { xs: 6, md: 10 } }}>
        <Dialog
          open={installOpen}
          onClose={() => setInstallOpen(false)}
          fullWidth
          maxWidth="sm"
          PaperProps={{ sx: { bgcolor: "#0B1C2D", color: "white", border: "1px solid rgba(255,255,255,0.10)" } }}
        >
          <DialogTitle sx={{ fontWeight: 800 }}>Install PG-IT Service Portal</DialogTitle>
          <DialogContent sx={{ color: "rgba(255,255,255,0.78)" }}>
            {!isHttpsOrLocalhost ? (
              <Typography variant="body2" sx={{ mb: 2 }}>
                PWA installation requires HTTPS. Open this site over HTTPS (recommended) to get the native install prompt.
              </Typography>
            ) : null}

            {isIos ? (
              <Typography variant="body2" sx={{ mb: 2 }}>
                On iPhone/iPad, install via Safari: Share → Add to Home Screen.
              </Typography>
            ) : isAndroid ? (
              <Typography variant="body2" sx={{ mb: 2 }}>
                On Android (Chrome), install via the browser menu: Install app / Add to Home screen.
              </Typography>
            ) : (
              <Typography variant="body2" sx={{ mb: 2 }}>
                On desktop, use the Install icon in the address bar (or browser menu) to install the PWA.
              </Typography>
            )}

            <Typography variant="body2" sx={{ mb: 2 }}>
              If you don’t see the install option, refresh the page once and make sure you’re not in Incognito/Private mode.
            </Typography>

            {apkUrl ? (
              <Typography variant="body2" sx={{ mb: 0 }}>
                Prefer the native Android APK instead of PWA? Use the button below.
              </Typography>
            ) : null}
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2 }}>
            {apkUrl ? (
              <Button
                variant="outlined"
                sx={{ borderColor: "rgba(255,255,255,0.45)", color: "white" }}
                onClick={() => window.open(apkUrl, "_blank", "noopener,noreferrer")}
              >
                Download Android APK
              </Button>
            ) : null}
            <Button
              variant="contained"
              onClick={() => setInstallOpen(false)}
              sx={{ bgcolor: "#2563eb", "&:hover": { bgcolor: "#1d4ed8" } }}
            >
              Close
            </Button>
          </DialogActions>
        </Dialog>

        <Grid container spacing={4} alignItems="center">
          <Grid item xs={12} md={7}>
            <Grow in={mounted} timeout={520}>
              <Stack spacing={2.2}>
                <Typography
                  variant="h3"
                  sx={{
                    fontWeight: 850,
                    lineHeight: 1.06,
                    letterSpacing: -0.6,
                  }}
                >
                  IT Service Management,
                  <Box component="span" sx={{ color: "#93c5fd" }}>
                    {" "}AI-assisted
                  </Box>
                </Typography>

                <Typography sx={{ color: "rgba(255,255,255,0.78)", maxWidth: 560 }}>
                  Create tickets in seconds, route them intelligently, track status, and keep employees informed—on web and as an installable app.
                </Typography>

                <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} sx={{ pt: 1 }}>
                  <Button
                    variant="contained"
                    size="large"
                    onClick={() => navigate("/login")}
                    sx={{
                      bgcolor: "#2563eb",
                      px: 3,
                      py: 1.2,
                      transition: "transform 160ms ease, box-shadow 160ms ease",
                      boxShadow: "0 16px 46px rgba(37, 99, 235, 0.26)",
                      "&:hover": {
                        bgcolor: "#1d4ed8",
                        transform: "translateY(-1px)",
                        boxShadow: "0 20px 54px rgba(37, 99, 235, 0.36)",
                      },
                    }}
                  >
                    Sign in
                  </Button>
                  <Button
                    variant="outlined"
                    size="large"
                    onClick={() => navigate("/login")}
                    sx={{
                      borderColor: "rgba(255,255,255,0.45)",
                      color: "white",
                      px: 3,
                      py: 1.2,
                      transition: "transform 160ms ease, background-color 160ms ease",
                      "&:hover": {
                        transform: "translateY(-1px)",
                        backgroundColor: "rgba(255,255,255,0.06)",
                        borderColor: "rgba(255,255,255,0.65)",
                      },
                    }}
                  >
                    Raise a ticket
                  </Button>
                </Stack>

                <Fade in={mounted} timeout={900}>
                  <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} sx={{ pt: 1 }}>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <CheckCircle fontSize="small" sx={{ color: "#86efac" }} />
                      <Typography variant="body2" sx={{ color: "rgba(255,255,255,0.78)" }}>
                        Role-based access
                      </Typography>
                    </Stack>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <CheckCircle fontSize="small" sx={{ color: "#86efac" }} />
                      <Typography variant="body2" sx={{ color: "rgba(255,255,255,0.78)" }}>
                        SLA-ready workflows
                      </Typography>
                    </Stack>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <CheckCircle fontSize="small" sx={{ color: "#86efac" }} />
                      <Typography variant="body2" sx={{ color: "rgba(255,255,255,0.78)" }}>
                        Installable PWA
                      </Typography>
                    </Stack>
                  </Stack>
                </Fade>
              </Stack>
            </Grow>
          </Grid>

          <Grid item xs={12} md={5}>
            <Grow in={mounted} timeout={760} style={{ transformOrigin: "80% 40%" }}>
              <Card
                sx={{
                  bgcolor: "rgba(255,255,255,0.06)",
                  color: "white",
                  border: "1px solid rgba(255,255,255,0.10)",
                  backdropFilter: "blur(10px)",
                  transition: "transform 220ms ease, border-color 220ms ease",
                  "&:hover": {
                    transform: "translateY(-3px)",
                    borderColor: "rgba(147, 197, 253, 0.26)",
                  },
                }}
              >
                <CardContent>
                  <Typography variant="h6" sx={{ fontWeight: 750, mb: 1 }}>
                    What you get
                  </Typography>
                  <Divider sx={{ borderColor: "rgba(255,255,255,0.12)", mb: 2 }} />

                  <Stack spacing={1.5}>
                    <Stack direction="row" spacing={1.2} alignItems="center">
                      <SupportAgent sx={{ color: "#93c5fd" }} />
                      <Typography sx={{ color: "rgba(255,255,255,0.85)" }}>
                        Employee self-service ticketing
                      </Typography>
                    </Stack>
                    <Stack direction="row" spacing={1.2} alignItems="center">
                      <Speed sx={{ color: "#93c5fd" }} />
                      <Typography sx={{ color: "rgba(255,255,255,0.85)" }}>
                        Faster triage with smart routing
                      </Typography>
                    </Stack>
                    <Stack direction="row" spacing={1.2} alignItems="center">
                      <AutoAwesome sx={{ color: "#93c5fd" }} />
                      <Typography sx={{ color: "rgba(255,255,255,0.85)" }}>
                        AI classification & confidence
                      </Typography>
                    </Stack>
                    <Stack direction="row" spacing={1.2} alignItems="center">
                      <Shield sx={{ color: "#93c5fd" }} />
                      <Typography sx={{ color: "rgba(255,255,255,0.85)" }}>
                        Secure auth with refresh token flow
                      </Typography>
                    </Stack>
                  </Stack>

                  <Button
                    fullWidth
                    variant="contained"
                    sx={{
                      mt: 3,
                      bgcolor: "#2563eb",
                      transition: "transform 160ms ease, box-shadow 160ms ease",
                      boxShadow: "0 16px 46px rgba(37, 99, 235, 0.26)",
                      "&:hover": {
                        bgcolor: "#1d4ed8",
                        transform: "translateY(-1px)",
                        boxShadow: "0 20px 54px rgba(37, 99, 235, 0.36)",
                      },
                    }}
                    onClick={() => navigate("/login")}
                  >
                    Continue to sign in
                  </Button>
                </CardContent>
              </Card>
            </Grow>
          </Grid>
        </Grid>

        <Box sx={{ pt: { xs: 6, md: 10 }, color: "rgba(255,255,255,0.68)" }}>
          <Typography variant="body2">
            © {new Date().getFullYear()} PG-IT Service Portal. Internal enterprise application.
          </Typography>
        </Box>
      </Container>
    </Box>
  );
};
