"use server";

export async function setAuthCookie(password: string) {
  const { cookies } = await import("next/headers");
  const cookieStore = await cookies();

  cookieStore.set("adminAuth", password, {
    httpOnly: false,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: 60 * 60 * 24, // 1 dia em segundos
    path: "/",
  });
}

export async function deleteAuthCookie() {
  const { cookies } = await import("next/headers");
  const cookieStore = await cookies();
  cookieStore.delete("adminAuth");
}
