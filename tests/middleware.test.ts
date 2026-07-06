import { describe, it, expect } from "vitest";
import { NextRequest } from "next/server";
import { middleware } from "../middleware";
import { signAdminSession, ADMIN_SESSION_COOKIE } from "@/lib/auth/admin-session";
import { signVoterSession, VOTER_SESSION_COOKIE } from "@/lib/auth/voter-session";

function requestWithCookie(url: string, cookieName?: string, cookieValue?: string) {
  const headers = new Headers();
  if (cookieName && cookieValue) {
    headers.set("cookie", `${cookieName}=${cookieValue}`);
  }
  return new NextRequest(url, { headers });
}

describe("middleware: admin routes", () => {
  it("redirects unauthenticated requests to /admin to the login page", async () => {
    const res = await middleware(requestWithCookie("http://localhost/admin"));
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("/admin/login");
  });

  it("lets /admin/login through without a session", async () => {
    const res = await middleware(requestWithCookie("http://localhost/admin/login"));
    expect(res.status).toBe(200);
  });

  it("lets /admin through with a valid admin session cookie", async () => {
    const token = await signAdminSession({ sub: "admin1", email: "a@b.com" });
    const res = await middleware(requestWithCookie("http://localhost/admin", ADMIN_SESSION_COOKIE, token));
    expect(res.status).toBe(200);
  });

  it("rejects a tampered/invalid admin session cookie", async () => {
    const res = await middleware(requestWithCookie("http://localhost/admin", ADMIN_SESSION_COOKIE, "not-a-real-jwt"));
    expect(res.status).toBe(307);
  });

  it("returns 401 JSON (not a redirect) for unauthenticated admin API calls", async () => {
    const res = await middleware(requestWithCookie("http://localhost/api/admin/codes"));
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe("Unauthorized");
  });

  it("lets /api/admin/login through without a session", async () => {
    const res = await middleware(requestWithCookie("http://localhost/api/admin/login"));
    expect(res.status).toBe(200);
  });
});

describe("middleware: voter ballot route", () => {
  it("redirects to code entry when visiting the ballot page without a voter session", async () => {
    const res = await middleware(requestWithCookie("http://localhost/vote/election1/ballot"));
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("/vote/election1");
  });

  it("allows the ballot page through with a matching voter session", async () => {
    const token = await signVoterSession({ voterSessionId: "vs1", electionId: "election1" });
    const res = await middleware(
      requestWithCookie("http://localhost/vote/election1/ballot", VOTER_SESSION_COOKIE, token)
    );
    expect(res.status).toBe(200);
  });

  it("redirects when the voter session's electionId does not match the requested election", async () => {
    const token = await signVoterSession({ voterSessionId: "vs1", electionId: "election-other" });
    const res = await middleware(
      requestWithCookie("http://localhost/vote/election1/ballot", VOTER_SESSION_COOKIE, token)
    );
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("/vote/election1");
  });

  it("does not protect the code-entry page itself", async () => {
    const res = await middleware(requestWithCookie("http://localhost/vote/election1"));
    expect(res.status).toBe(200);
  });

  it("returns 401 JSON for ballot submission without a voter session", async () => {
    const res = await middleware(requestWithCookie("http://localhost/api/voter/ballot"));
    expect(res.status).toBe(401);
  });

  it("allows ballot submission through with a valid voter session", async () => {
    const token = await signVoterSession({ voterSessionId: "vs1", electionId: "election1" });
    const res = await middleware(requestWithCookie("http://localhost/api/voter/ballot", VOTER_SESSION_COOKIE, token));
    expect(res.status).toBe(200);
  });

  it("does not protect access-code verification itself", async () => {
    const res = await middleware(requestWithCookie("http://localhost/api/voter/verify"));
    expect(res.status).toBe(200);
  });
});
