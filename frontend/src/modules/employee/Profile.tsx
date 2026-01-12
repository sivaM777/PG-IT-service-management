import React from "react";
import { Box, Card, CardContent, Typography, Stack, Divider, Chip } from "@mui/material";
import { useAuth } from "../../services/auth";

export const Profile: React.FC = () => {
  const { user } = useAuth();

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Profile
      </Typography>

      <Card>
        <CardContent>
          <Stack spacing={1.5}>
            <Stack direction="row" spacing={1} alignItems="center">
              <Typography variant="h6" sx={{ flexGrow: 1 }}>
                {user?.name || "User"}
              </Typography>
              {user?.role ? <Chip label={user.role} color="primary" size="small" /> : null}
            </Stack>

            <Typography color="text.secondary">{user?.email || ""}</Typography>

            <Divider />

            <Typography variant="subtitle2" color="text.secondary">
              Team
            </Typography>
            <Typography>{user?.team_id ? user.team_id : "Not assigned"}</Typography>
          </Stack>
        </CardContent>
      </Card>
    </Box>
  );
};
