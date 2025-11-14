import { describe, it, expect } from "bun:test";
import { createAdminJWT, verifyAdminJWT, requireAdmin } from "@/lib/adminAuth";

describe("adminAuth", () => {
  it("create and verify jwt", () => {
    process.env.ADMIN_TOKEN = "test-secret";
    const jwt = createAdminJWT(process.env.ADMIN_TOKEN!);
    expect(verifyAdminJWT(process.env.ADMIN_TOKEN!, jwt)).toBe(true);
  });

  it("requireAdmin accepts cookie jwt", () => {
    process.env.ADMIN_TOKEN = "test-secret";
    const jwt = createAdminJWT(process.env.ADMIN_TOKEN!);
    const req = new Request("http://localhost", {
      headers: { cookie: `admin_jwt=${encodeURIComponent(jwt)}` },
    });
    const resp = requireAdmin(req as Request);
    expect(resp).toBeUndefined();
  });

  it("requireAdmin denies invalid jwt", () => {
    process.env.ADMIN_TOKEN = "test-secret";
    const req = new Request("http://localhost", {
      headers: { cookie: `admin_jwt=badtoken` },
    });
    const resp = requireAdmin(req as Request);
    expect(resp).not.toBeUndefined();
  });
});
