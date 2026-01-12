import crypto from "crypto";
import bcrypt from "bcryptjs";
import { pool } from "../../config/db.js";

export type UserRole = "EMPLOYEE" | "AGENT" | "ADMIN";

export interface DbUser {
  id: string;
  name: string;
  email: string;
  password_hash: string;
  role: UserRole;
  team_id: string | null;
  created_at: string;
}

export interface PublicUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  team_id: string | null;
}

export const toPublicUser = (u: DbUser): PublicUser => ({
  id: u.id,
  name: u.name,
  email: u.email,
  role: u.role,
  team_id: u.team_id,
});

export const findUserByEmail = async (email: string): Promise<DbUser | null> => {
  const res = await pool.query<DbUser>(
    "SELECT id, name, email, password_hash, role, team_id, created_at FROM users WHERE email = $1",
    [email.toLowerCase()]
  );
  return res.rows[0] ?? null;
};

export const findUserById = async (id: string): Promise<DbUser | null> => {
  const res = await pool.query<DbUser>(
    "SELECT id, name, email, password_hash, role, team_id, created_at FROM users WHERE id = $1",
    [id]
  );
  return res.rows[0] ?? null;
};

export const verifyPassword = async (password: string, passwordHash: string) => {
  return bcrypt.compare(password, passwordHash);
};

export const hashPassword = async (password: string) => {
  const saltRounds = 12;
  return bcrypt.hash(password, saltRounds);
};

const sha256 = (value: string) => crypto.createHash("sha256").update(value).digest("hex");

export const createRefreshToken = async (userId: string, ttlDays: number) => {
  const raw = crypto.randomBytes(48).toString("base64url");
  const tokenHash = sha256(raw);

  const res = await pool.query<{ id: string }>(
    "INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, now() + ($3 || ' days')::interval) RETURNING id",
    [userId, tokenHash, String(ttlDays)]
  );

  return {
    id: res.rows[0]!.id,
    token: raw,
  };
};

export const rotateRefreshToken = async (rawToken: string, ttlDays: number) => {
  const tokenHash = sha256(rawToken);

  const existing = await pool.query<{
    id: string;
    user_id: string;
    expires_at: string;
    revoked_at: string | null;
  }>(
    "SELECT id, user_id, expires_at, revoked_at FROM refresh_tokens WHERE token_hash = $1",
    [tokenHash]
  );

  const row = existing.rows[0];
  if (!row) return null;
  if (row.revoked_at) return null;
  if (new Date(row.expires_at).getTime() <= Date.now()) return null;

  await pool.query("UPDATE refresh_tokens SET revoked_at = now() WHERE id = $1", [row.id]);

  const next = await createRefreshToken(row.user_id, ttlDays);
  return { userId: row.user_id, token: next.token };
};

export const revokeRefreshToken = async (rawToken: string) => {
  const tokenHash = sha256(rawToken);
  await pool.query("UPDATE refresh_tokens SET revoked_at = now() WHERE token_hash = $1", [tokenHash]);
};
