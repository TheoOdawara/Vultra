import { apiRequest } from "@/shared/api/http";
import { parseSession, SESSION_PATH, type Session } from "./session";

export async function fetchCurrentSession(): Promise<Session | null> {
  try {
    const response = await apiRequest<unknown>(SESSION_PATH);
    return response.notModified ? null : parseSession(response.data);
  } catch {
    return null;
  }
}
