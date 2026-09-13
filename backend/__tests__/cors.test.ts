import request from "supertest";
import { app } from "./setup";

const preflightedRoute = "/api/auth/employee/signup";

describe("CORS allowlist", () => {
  beforeAll(() => {
    if (!app) return;
  });

  it("echoes the origin for the configured frontend", async () => {
    if (!app) return;
    const origin = process.env.FRONTEND_URL || "https://backup-alt.github.io/AJUI";
    const res = await request(app)
      .options(preflightedRoute)
      .set("Origin", origin)
      .set("Access-Control-Request-Method", "POST")
      .set("Access-Control-Request-Headers", "Content-Type");
    expect(res.status).toBe(204);
    expect(res.headers["access-control-allow-origin"]).toBe(origin);
  });

  it("echoes the origin for the backend's own public URL", async () => {
    if (!app) return;
    const origin = process.env.BACKEND_PUBLIC_URL || "https://agb-o3cc.onrender.com";
    const res = await request(app)
      .options(preflightedRoute)
      .set("Origin", origin)
      .set("Access-Control-Request-Method", "POST")
      .set("Access-Control-Request-Headers", "Content-Type");
    expect(res.status).toBe(204);
    expect(res.headers["access-control-allow-origin"]).toBe(origin);
  });
});