import request from "supertest";
import { app } from "./setup";
import { generateId } from "../src/services/id-generator.service";
import { Client } from "../src/models/Client";
import { Project } from "../src/models/Project";
import { Counter } from "../src/models/Counter";

let token = "";

const loginAndGetToken = async () => {
  const res = await request(app).post("/api/auth/login").send({
    phone: "+919999999999",
    password: "TestPass123",
  });
  return res.body.accessToken;
};

beforeAll(async () => {
  if (!app) return;
  token = await loginAndGetToken();
});

beforeEach(async () => {
  if (!app) return;
  await Client.deleteMany({});
  await Project.deleteMany({});
  await Counter.deleteMany({});
});

describe("Auth endpoints", () => {
  it("POST /api/auth/login - valid credentials returns token", async () => {
    if (!app) return;
    const res = await request(app).post("/api/auth/login").send({
      phone: "+919999999999",
      password: "TestPass123",
    });
    expect(res.status).toBe(200);
    expect(res.body.accessToken).toBeDefined();
    expect(res.body.user.role).toBe("admin");
  });

  it("POST /api/auth/login - wrong password returns 401", async () => {
    if (!app) return;
    const res = await request(app).post("/api/auth/login").send({
      phone: "+919999999999",
      password: "WrongPass123",
    });
    expect(res.status).toBe(401);
  });

  it("POST /api/auth/login - missing fields returns 400", async () => {
    if (!app) return;
    const res = await request(app).post("/api/auth/login").send({});
    expect(res.status).toBe(400);
  });

  it("GET /api/auth/me - returns user when authenticated", async () => {
    if (!app) return;
    const res = await request(app).get("/api/auth/me").set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.user.phone).toBe("+919999999999");
  });

  it("GET /api/auth/me - returns 401 without token", async () => {
    if (!app) return;
    const res = await request(app).get("/api/auth/me");
    expect(res.status).toBe(401);
  });
});

describe("Client CRUD", () => {
  it("POST /api/clients - creates client", async () => {
    if (!app) return;
    const res = await request(app)
      .post("/api/clients")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Test Client", mobile: "+919876543210", address: "Test Address" });
    expect(res.status).toBe(201);
    expect(res.body.client.clientId).toMatch(/^CLI-\d+$/);
    expect(res.body.client.initials).toBe("TC");
  });

  it("GET /api/clients - lists clients", async () => {
    if (!app) return;
    await Client.create({
      clientId: await generateId("CLI"),
      name: "Listed Client",
      mobile: "+919876500001",
      address: "X",
      status: "Active",
      projectIds: [],
    });
    const res = await request(app).get("/api/clients").set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.items.length).toBeGreaterThanOrEqual(1);
    expect(res.body.total).toBeGreaterThanOrEqual(1);
  });

  it("GET /api/clients - rejects without auth", async () => {
    if (!app) return;
    const res = await request(app).get("/api/clients");
    expect(res.status).toBe(401);
  });
});

describe("Project CRUD", () => {
  let clientId = "";

  beforeEach(async () => {
    if (!app) return;
    const client = await Client.create({
      clientId: await generateId("CLI"),
      name: "Project Client",
      mobile: "+919876500002",
      address: "X",
      status: "Active",
      projectIds: [],
    });
    clientId = client._id.toString();
  });

  it("POST /api/projects - creates project linked to client", async () => {
    if (!app) return;
    const res = await request(app)
      .post("/api/projects")
      .set("Authorization", `Bearer ${token}`)
      .send({
        name: "Test Project",
        clientId,
        mobile: "+919876500002",
        address: "Project Address",
        supervisor: "Test Supervisor",
        startDate: "2026-01-01",
        totalValue: 1000000,
      });
    expect(res.status).toBe(201);
    expect(res.body.project.projectId).toMatch(/^AB-\d+$/);
    expect(res.body.project.totalValue).toBe(1000000);
    expect(res.body.project.pendingBalance).toBeGreaterThanOrEqual(0);

    const client = await Client.findById(clientId).lean();
    expect(client?.projectIds.length).toBe(1);
  });

  it("POST /api/projects - fails with invalid clientId", async () => {
    if (!app) return;
    const res = await request(app)
      .post("/api/projects")
      .set("Authorization", `Bearer ${token}`)
      .send({
        name: "Bad Project",
        clientId: "000000000000000000000000",
        mobile: "+919876500002",
        address: "X",
        supervisor: "S",
        startDate: "2026-01-01",
      });
    expect(res.status).toBe(404);
  });
});

describe("Dashboard KPIs", () => {
  it("GET /api/dashboard/kpis - returns aggregated metrics", async () => {
    if (!app) return;
    const res = await request(app).get("/api/dashboard/kpis").set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.kpis).toBeDefined();
    expect(res.body.kpis.counts).toBeDefined();
    expect(res.body.kpis.financials).toBeDefined();
    expect(typeof res.body.kpis.counts.clients.total).toBe("number");
  });
});

describe("RBAC", () => {
  it("GET /api/me/permissions - returns admin's permissions", async () => {
    if (!app) return;
    const res = await request(app).get("/api/me/permissions").set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.role).toBe("admin");
  });

  it("GET /api/permissions - admin only", async () => {
    if (!app) return;
    const res = await request(app).get("/api/permissions").set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.permissions.length).toBeGreaterThan(0);
  });
});

describe("Swagger docs", () => {
  it("GET /api/docs.json - returns OpenAPI spec", async () => {
    if (!app) return;
    const res = await request(app).get("/api/docs.json");
    expect(res.status).toBe(200);
    expect(res.body.openapi).toBe("3.0.3");
    expect(res.body.info.title).toBe("AJUI Backend API");
  });

  it("GET /api/docs/ - serves Swagger UI HTML", async () => {
    if (!app) return;
    const res = await request(app).get("/api/docs/");
    expect(res.status).toBe(200);
    expect(res.text).toContain("swagger-ui");
  });
});

describe("Health check", () => {
  it("GET /health - returns ok", async () => {
    if (!app) return;
    const res = await request(app).get("/health");
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("ok");
  });
});
