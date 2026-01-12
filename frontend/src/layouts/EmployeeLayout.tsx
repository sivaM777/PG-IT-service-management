import React from "react";
import { Outlet, useNavigate } from "react-router-dom";
import { useTheme } from "@mui/material/styles";
import {
  AppBar,
  Box,
  CssBaseline,
  Drawer,
  Button,
  IconButton,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Toolbar,
  Typography,
  Avatar,
  Menu,
  MenuItem,
  Badge,
  Divider,
  ListItemAvatar,
  ListItemSecondaryAction,
  CircularProgress,
  useMediaQuery,
} from "@mui/material";
import {
  Dashboard as DashboardIcon,
  SupportAgent as SupportIcon,
  Search as SearchIcon,
  Notifications as NotifIcon,
  Menu as MenuIcon,
} from "@mui/icons-material";
import { useAuth } from "../services/auth";
import { api, getApiErrorMessage } from "../services/api";
import { usePwaInstallPrompt } from "../utils/usePwaInstallPrompt";
import { ChatWidget } from "../components/chatbot/ChatWidget";

const drawerWidth = 240;

type NotificationRow = {
  id: string;
  ticket_id: string | null;
  type: "TICKET_CREATED" | "TICKET_ASSIGNED" | "TICKET_STATUS_CHANGED";
  title: string;
  body: string;
  read_at: string | null;
  created_at: string;
};

export const EmployeeLayout: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
  const { isInstallable, promptInstall } = usePwaInstallPrompt();
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const [anchorEl, setAnchorEl] = React.useState<null | HTMLElement>(null);
  const [notifAnchorEl, setNotifAnchorEl] = React.useState<null | HTMLElement>(null);
  const [unreadCount, setUnreadCount] = React.useState<number>(0);
  const [notifError, setNotifError] = React.useState<string>("");
  const [notifLoading, setNotifLoading] = React.useState<boolean>(false);
  const [notifications, setNotifications] = React.useState<NotificationRow[]>([]);

  const toggleMobileDrawer = () => {
    setMobileOpen((prev) => !prev);
  };

  const closeMobileDrawer = () => {
    setMobileOpen(false);
  };

  const handleMenu = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const openNotifMenu = (event: React.MouseEvent<HTMLElement>) => {
    setNotifAnchorEl(event.currentTarget);
  };

  const closeNotifMenu = () => {
    setNotifAnchorEl(null);
  };

  const fetchUnreadCount = React.useCallback(async () => {
    try {
      const res = await api.get<{ count: number }>("/notifications/unread-count");
      setUnreadCount(Number(res.data?.count ?? 0));
    } catch {
      return;
    }
  }, []);

  const fetchNotifications = React.useCallback(async () => {
    setNotifLoading(true);
    setNotifError("");
    try {
      const res = await api.get<NotificationRow[]>("/notifications", { params: { limit: 10 } });
      setNotifications(res.data || []);
    } catch (e: unknown) {
      setNotifError(getApiErrorMessage(e, "Failed to load notifications"));
    } finally {
      setNotifLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void fetchUnreadCount();
    const t = window.setInterval(() => void fetchUnreadCount(), 30000);
    return () => window.clearInterval(t);
  }, [fetchUnreadCount]);

  React.useEffect(() => {
    if (!notifAnchorEl) return;
    void fetchUnreadCount();
    void fetchNotifications();
  }, [notifAnchorEl, fetchNotifications, fetchUnreadCount]);

  const onClickNotification = async (n: NotificationRow) => {
    if (!n.read_at) {
      try {
        await api.post(`/notifications/${n.id}/read`);
        setNotifications((prev) => prev.map((x) => (x.id === n.id ? { ...x, read_at: new Date().toISOString() } : x)));
        setUnreadCount((c) => Math.max(0, c - 1));
      } catch {
        return;
      }
    }
    if (n.ticket_id) {
      closeNotifMenu();
      navigate(`/app/tickets/${n.ticket_id}`);
    }
  };

  const markAllRead = async () => {
    try {
      await api.post("/notifications/read-all");
      setNotifications((prev) => prev.map((n) => ({ ...n, read_at: n.read_at ?? new Date().toISOString() })));
      setUnreadCount(0);
    } catch {
      return;
    }
  };

  const menuItems = [
    { text: "Dashboard", icon: <DashboardIcon />, path: "/app" },
    { text: "My Tickets", icon: <SupportIcon />, path: "/app/tickets" },
    { text: "Knowledge Base", icon: <SearchIcon />, path: "/app/kb" },
  ];

  return (
    <Box sx={{ display: "flex" }}>
      <CssBaseline />
      <AppBar
        position="fixed"
        sx={{ zIndex: (theme) => theme.zIndex.drawer + 1 }}
      >
        <Toolbar>
          {isMobile && (
            <IconButton color="inherit" edge="start" onClick={toggleMobileDrawer} sx={{ mr: 1 }}>
              <MenuIcon />
            </IconButton>
          )}
          <Typography variant="h6" noWrap component="div" sx={{ flexGrow: 1 }}>
            PG-IT Service Portal
          </Typography>
          {isInstallable && (
            <Button
              color="inherit"
              variant="outlined"
              size="small"
              onClick={() => void promptInstall()}
              sx={{ mr: 1, borderColor: "rgba(255,255,255,0.5)" }}
            >
              Install App
            </Button>
          )}
          <IconButton color="inherit" onClick={openNotifMenu}>
            <Badge badgeContent={unreadCount} color="error">
              <NotifIcon />
            </Badge>
          </IconButton>
          <Menu
            anchorEl={notifAnchorEl}
            open={Boolean(notifAnchorEl)}
            onClose={closeNotifMenu}
            anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
            transformOrigin={{ vertical: "top", horizontal: "right" }}
            PaperProps={{ sx: { width: 380, maxWidth: "90vw" } }}
          >
            <MenuItem disabled>Notifications</MenuItem>
            <Divider />
            {notifLoading && (
              <MenuItem disabled sx={{ display: "flex", justifyContent: "center" }}>
                <CircularProgress size={18} />
              </MenuItem>
            )}
            {notifError && <MenuItem disabled>{notifError}</MenuItem>}
            {!notifLoading && !notifError && notifications.length === 0 && (
              <MenuItem disabled>No notifications</MenuItem>
            )}
            {notifications.map((n) => (
              <MenuItem key={n.id} onClick={() => void onClickNotification(n)}>
                <ListItemAvatar>
                  <Avatar sx={{ width: 28, height: 28 }}>{n.title[0]?.toUpperCase() || "N"}</Avatar>
                </ListItemAvatar>
                <ListItemText primary={n.title} secondary={n.body} />
                <ListItemSecondaryAction>
                  {!n.read_at ? (
                    <Badge variant="dot" color="error" />
                  ) : (
                    <Typography variant="caption" color="text.secondary">
                      {new Date(n.created_at).toLocaleDateString()}
                    </Typography>
                  )}
                </ListItemSecondaryAction>
              </MenuItem>
            ))}
            <Divider />
            <MenuItem onClick={() => void markAllRead()} disabled={unreadCount === 0}>
              Mark all as read
            </MenuItem>
          </Menu>
          <IconButton
            size="large"
            aria-label="account of current user"
            aria-controls="menu-appbar"
            aria-haspopup="true"
            onClick={handleMenu}
            color="inherit"
          >
            <Avatar sx={{ width: 32, height: 32 }}>
              {user?.name?.[0]?.toUpperCase() || "U"}
            </Avatar>
          </IconButton>
          <Menu
            id="menu-appbar"
            anchorEl={anchorEl}
            anchorOrigin={{
              vertical: "top",
              horizontal: "right",
            }}
            keepMounted
            transformOrigin={{
              vertical: "top",
              horizontal: "right",
            }}
            open={Boolean(anchorEl)}
            onClose={handleClose}
          >
            <MenuItem
              onClick={() => {
                handleClose();
                navigate("/app/profile");
              }}
            >
              Profile
            </MenuItem>
            <MenuItem onClick={logout}>Logout</MenuItem>
          </Menu>
        </Toolbar>
      </AppBar>
      <Drawer
        variant={isMobile ? "temporary" : "permanent"}
        open={isMobile ? mobileOpen : true}
        onClose={isMobile ? toggleMobileDrawer : undefined}
        ModalProps={isMobile ? { keepMounted: true } : undefined}
        sx={{
          width: drawerWidth,
          flexShrink: 0,
          [`& .MuiDrawer-paper`]: {
            width: drawerWidth,
            boxSizing: "border-box",
          },
        }}
      >
        <Toolbar />
        <Box sx={{ overflow: "auto" }}>
          <List>
            {menuItems.map((item) => (
              <ListItem key={item.text} disablePadding>
                <ListItemButton
                  onClick={() => {
                    navigate(item.path);
                    if (isMobile) closeMobileDrawer();
                  }}
                >
                  <ListItemIcon>{item.icon}</ListItemIcon>
                  <ListItemText primary={item.text} />
                </ListItemButton>
              </ListItem>
            ))}
          </List>
        </Box>
      </Drawer>
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          p: { xs: 2, sm: 3 },
          width: { sm: `calc(100% - ${drawerWidth}px)` },
        }}
      >
        <Toolbar />
        <Outlet />
        <ChatWidget />
      </Box>
    </Box>
  );
};
