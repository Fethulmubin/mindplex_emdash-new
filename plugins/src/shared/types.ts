export type Role = "user" | "collaborator" | "editor" | "moderator" | "admin";

export interface SessionUser {
  id: string;
  email: string;
  role: Role;
}
