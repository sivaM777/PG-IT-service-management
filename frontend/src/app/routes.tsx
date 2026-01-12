import { createBrowserRouter, Navigate, useParams } from "react-router-dom";
import { AuthGuard } from "./auth-guard";
import { RoleGuard } from "./role-guard";
import { EmployeeLayout } from "../layouts/EmployeeLayout";
import { AdminLayout } from "../layouts/AdminLayout";
import { Login } from "../modules/auth/Login";
import { Landing } from "../modules/public/Landing";
import { Home } from "../modules/employee/Home";
import { MyTickets } from "../modules/employee/MyTickets";
import { TicketDetail as EmployeeTicketDetail } from "../modules/employee/TicketDetail";
import { KnowledgeBase } from "../modules/employee/KnowledgeBase";
import { Profile } from "../modules/employee/Profile";
import { Dashboard } from "../modules/admin/Dashboard";
import { TicketInbox } from "../modules/admin/TicketInbox";
import { TicketDetail as AdminTicketDetail } from "../modules/admin/TicketDetail";
import { Reports } from "../modules/admin/Reports";
import { Settings } from "../modules/admin/Settings";
import { Users } from "../modules/admin/Users";
import { Teams } from "../modules/admin/Teams";

const LegacyEmployeeTicketRedirect = () => {
  const { id } = useParams<{ id: string }>();
  return <Navigate to={id ? `/app/tickets/${id}` : "/app/tickets"} replace />;
};

export const router = createBrowserRouter([
  {
    path: "/",
    element: <Landing />,
  },
  {
    path: "/login",
    element: <Login />,
  },
  {
    path: "/tickets",
    element: <Navigate to="/app/tickets" replace />,
  },
  {
    path: "/tickets/:id",
    element: <LegacyEmployeeTicketRedirect />,
  },
  {
    path: "/kb",
    element: <Navigate to="/app/kb" replace />,
  },
  {
    path: "/app",
    element: (
      <AuthGuard>
        <RoleGuard allowedRoles={["EMPLOYEE"]}>
          <EmployeeLayout />
        </RoleGuard>
      </AuthGuard>
    ),
    children: [
      { index: true, element: <Home /> },
      { path: "tickets", element: <MyTickets /> },
      { path: "tickets/:id", element: <EmployeeTicketDetail /> },
      { path: "kb", element: <KnowledgeBase /> },
      { path: "profile", element: <Profile /> },
    ],
  },
  {
    path: "/admin",
    element: (
      <AuthGuard>
        <RoleGuard allowedRoles={["ADMIN", "AGENT"]}>
          <AdminLayout />
        </RoleGuard>
      </AuthGuard>
    ),
    children: [
      { index: true, element: <Navigate to="/admin/dashboard" replace /> },
      { path: "dashboard", element: <Dashboard /> },
      { path: "tickets", element: <TicketInbox /> },
      { path: "tickets/:id", element: <AdminTicketDetail /> },
      { path: "reports", element: <Reports /> },
      {
        path: "users",
        element: (
          <RoleGuard allowedRoles={["ADMIN"]}>
            <Users />
          </RoleGuard>
        ),
      },
      {
        path: "teams",
        element: (
          <RoleGuard allowedRoles={["ADMIN"]}>
            <Teams />
          </RoleGuard>
        ),
      },
      {
        path: "settings",
        element: (
          <RoleGuard allowedRoles={["ADMIN"]}>
            <Settings />
          </RoleGuard>
        ),
      },
    ],
  },
]);
