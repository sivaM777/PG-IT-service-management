import React from "react";
import { Box, Paper, Typography, Stepper, Step, StepLabel, Chip, LinearProgress } from "@mui/material";
import {
  Create as CreateIcon,
  Psychology as AIIcon,
  Route as RouteIcon,
  Assignment as AssignIcon,
  CheckCircle as ResolveIcon,
  Notifications as NotifyIcon,
} from "@mui/icons-material";

interface TicketFlowProps {
  ticketId: string;
  status: "OPEN" | "IN_PROGRESS" | "RESOLVED" | "CLOSED";
  category?: string | null;
  aiConfidence?: number | null;
  assignedTeam?: string | null;
  assignedAgent?: string | null;
  sourceType?: string;
}

const steps = [
  { label: "Ticket Created", icon: CreateIcon, key: "created" },
  { label: "AI Classification", icon: AIIcon, key: "classification" },
  { label: "Intelligent Routing", icon: RouteIcon, key: "routing" },
  { label: "Assignment", icon: AssignIcon, key: "assignment" },
  { label: "Notification Sent", icon: NotifyIcon, key: "notification" },
  { label: "Resolution", icon: ResolveIcon, key: "resolution" },
];

export const TicketFlowVisualization: React.FC<TicketFlowProps> = ({
  status,
  category,
  aiConfidence,
  assignedTeam,
  assignedAgent,
  sourceType,
}) => {
  const getActiveStep = () => {
    switch (status) {
      case "OPEN":
        return assignedAgent ? 3 : assignedTeam ? 2 : category ? 1 : 0;
      case "IN_PROGRESS":
        return 4;
      case "RESOLVED":
      case "CLOSED":
        return 5;
      default:
        return 0;
    }
  };

  const activeStep = getActiveStep();

  return (
    <Paper sx={{ p: 3, mb: 3, background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)", color: "white" }}>
      <Typography variant="h6" gutterBottom sx={{ color: "white", fontWeight: 600 }}>
        Ticket Processing Flow
      </Typography>
      
      {sourceType && (
        <Chip
          label={`Source: ${sourceType}`}
          size="small"
          sx={{ mb: 2, bgcolor: "rgba(255,255,255,0.2)", color: "white" }}
        />
      )}

      <Stepper activeStep={activeStep} alternativeLabel sx={{ mt: 2 }}>
        {steps.map((step, index) => {
          const StepIcon = step.icon;
          const isCompleted = index < activeStep;
          const isActive = index === activeStep;

          return (
            <Step key={step.key} completed={isCompleted} active={isActive}>
              <StepLabel
                StepIconComponent={() => (
                  <Box
                    sx={{
                      width: 48,
                      height: 48,
                      borderRadius: "50%",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      bgcolor: isCompleted
                        ? "rgba(255,255,255,0.9)"
                        : isActive
                        ? "rgba(255,255,255,0.7)"
                        : "rgba(255,255,255,0.3)",
                      color: isCompleted || isActive ? "#667eea" : "white",
                      transition: "all 0.3s ease",
                      boxShadow: isActive ? "0 4px 12px rgba(0,0,0,0.3)" : "none",
                    }}
                  >
                    <StepIcon />
                  </Box>
                )}
              >
                <Typography
                  variant="caption"
                  sx={{
                    color: isCompleted || isActive ? "white" : "rgba(255,255,255,0.7)",
                    fontWeight: isActive ? 600 : 400,
                    mt: 1,
                  }}
                >
                  {step.label}
                </Typography>
              </StepLabel>
            </Step>
          );
        })}
      </Stepper>

      {/* Additional Info */}
      <Box sx={{ mt: 3, display: "flex", flexWrap: "wrap", gap: 2 }}>
        {category && (
          <Box sx={{ bgcolor: "rgba(255,255,255,0.2)", p: 1.5, borderRadius: 2, flex: 1, minWidth: 200 }}>
            <Typography variant="caption" sx={{ display: "block", opacity: 0.9 }}>
              AI Category
            </Typography>
            <Typography variant="body2" sx={{ fontWeight: 600 }}>
              {category}
            </Typography>
            {aiConfidence !== null && aiConfidence !== undefined && (
              <Box sx={{ mt: 1 }}>
                <LinearProgress
                  variant="determinate"
                  value={(aiConfidence ?? 0) * 100}
                  sx={{
                    height: 6,
                    borderRadius: 3,
                    bgcolor: "rgba(255,255,255,0.3)",
                    "& .MuiLinearProgress-bar": {
                      bgcolor: "white",
                    },
                  }}
                />
                <Typography variant="caption" sx={{ mt: 0.5, display: "block" }}>
                  Confidence: {Math.round((aiConfidence ?? 0) * 100)}%
                </Typography>
              </Box>
            )}
          </Box>
        )}

        {assignedTeam && (
          <Box sx={{ bgcolor: "rgba(255,255,255,0.2)", p: 1.5, borderRadius: 2, flex: 1, minWidth: 200 }}>
            <Typography variant="caption" sx={{ display: "block", opacity: 0.9 }}>
              Assigned Team
            </Typography>
            <Typography variant="body2" sx={{ fontWeight: 600 }}>
              {assignedTeam}
            </Typography>
          </Box>
        )}

        {assignedAgent && (
          <Box sx={{ bgcolor: "rgba(255,255,255,0.2)", p: 1.5, borderRadius: 2, flex: 1, minWidth: 200 }}>
            <Typography variant="caption" sx={{ display: "block", opacity: 0.9 }}>
              Assigned Agent
            </Typography>
            <Typography variant="body2" sx={{ fontWeight: 600 }}>
              {assignedAgent}
            </Typography>
          </Box>
        )}
      </Box>
    </Paper>
  );
};
