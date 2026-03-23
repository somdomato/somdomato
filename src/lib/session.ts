const SESSION_EXPIRATION_SECONDS = 60 * 60 * 24 * 7; // 7 dias
const COOKIE_SESSION_KEY = "session-id";

export type UserSession = {
  id: string;
  role: "user" | "admin";
};

export type Cookies = {
  set: (
    key: string,
    value: string,
    options: {
      secure?: boolean;
      httpOnly?: boolean;
      sameSite?: "strict" | "lax";
      expires?: number;
    },
  ) => void;
  get: (key: string) => { name: string; value: string } | undefined;
  delete: (key: string) => void;
};

function encodeSession(session: UserSession) {
  return Buffer.from(JSON.stringify(session)).toString("base64");
}

function decodeSession(raw: string | undefined): UserSession | null {
  if (!raw) return null;
  try {
    const decoded = Buffer.from(raw, "base64").toString("utf8");
    const parsed = JSON.parse(decoded);
    if (
      parsed &&
      typeof parsed.id === "string" &&
      (parsed.role === "user" || parsed.role === "admin")
    ) {
      return parsed as UserSession;
    }
    return null;
  } catch {
    return null;
  }
}

export function getUserFromSession(cookies: Pick<Cookies, "get">) {
  const raw = cookies.get(COOKIE_SESSION_KEY)?.value;
  return decodeSession(raw);
}

export async function createUserSession(
  user: { id?: number | string; role: string },
  cookies: Pick<Cookies, "set">,
) {
  const sessionId = user.id != null ? String(user.id) : crypto.randomUUID();
  const role = user.role === "admin" ? "admin" : "user";
  const userSession: UserSession = { id: sessionId, role };
  setCookie(userSession, cookies);
  return userSession;
}

export async function removeUserFromSession(
  cookies: Pick<Cookies, "get" | "delete">,
) {
  const existing = cookies.get(COOKIE_SESSION_KEY)?.value;
  if (existing == null) return null;
  cookies.delete(COOKIE_SESSION_KEY);
  return true;
}

function setCookie(session: UserSession, cookies: Pick<Cookies, "set">) {
  const encoded = encodeSession(session);
  cookies.set(COOKIE_SESSION_KEY, encoded, {
    secure: true,
    httpOnly: true,
    sameSite: "lax",
    expires: Date.now() + SESSION_EXPIRATION_SECONDS * 1000,
  });
}
