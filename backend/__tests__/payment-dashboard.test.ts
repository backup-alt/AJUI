import request from "supertest";
import { app } from "./setup";
import { Approval } from "../src/models/Approval";
import { Client } from "../src/models/Client";
import { Counter } from "../src/models/Counter";
import { Payment } from "../src/models/Payment";
import { Project } from "../src/models/Project";
import { generateId } from "../src/services/id-generator.service";

let token = "";

beforeAll(async () => {
  if (!app) return;
  const response = await request(app).post("/api/auth/login").send({
    phone: "+919999999999",
    password: "TestPass123",
  });
  token = response.body.accessToken;
});

beforeEach(async () => {
  if (!app) return;
  await Promise.all([
    Approval.deleteMany({}),
    Payment.deleteMany({}),
    Project.deleteMany({}),
    Client.deleteMany({}),
    Counter.deleteMany({}),
  ]);
});

describe("Payment to dashboard flow", () => {
  it("persists a workspace payment and immediately updates project, client, and dashboard totals", async () => {
    if (!app) return;

    const client = await Client.create({
      clientId: await generateId("CLI"),
      name: "Collections Client",
      mobile: "+919876500021",
      address: "Chennai",
      status: "Active",
      projectIds: [],
    });
    const project = await Project.create({
      projectId: await generateId("AB"),
      name: "Collections Project",
      client: client.name,
      clientId: client._id,
      mobile: client.mobile,
      address: client.address,
      supervisor: "Test Supervisor",
      siteIds: [],
      siteNames: [],
      status: "Active",
      startDate: "2026-08-21",
      totalValue: 100_000,
    });

    const create = await request(app)
      .post("/api/payments")
      .set("Authorization", `Bearer ${token}`)
      .send({
        projectId: project._id.toString(),
        clientId: client._id.toString(),
        date: "2026-08-21",
        amount: 25_000,
        mode: "RTGS",
        transactionReference: "TEST-RTGS-001",
        collectedBy: "Test Admin",
      });

    expect(create.status).toBe(201);
    expect(create.body.payment.status).toBe("Pending");
    expect(await Payment.countDocuments({ projectId: project._id })).toBe(1);

    const refreshedProject = await Project.findById(project._id).lean();
    expect(refreshedProject?.receivedAmount).toBe(25_000);
    expect(refreshedProject?.pendingBalance).toBe(75_000);
    expect(refreshedProject?.completion).toBe(25);

    const refreshedClient = await Client.findById(client._id).lean();
    expect(refreshedClient?.amountReceived).toBe(25_000);

    const dashboard = await request(app)
      .get("/api/dashboard/kpis")
      .set("Authorization", `Bearer ${token}`);
    expect(dashboard.status).toBe(200);
    expect(dashboard.body.kpis.financials.totalReceived).toBe(25_000);
  });

  it("removes a rejected payment from collection totals", async () => {
    if (!app) return;

    const client = await Client.create({
      clientId: await generateId("CLI"),
      name: "Rejected Collections Client",
      mobile: "+919876500022",
      address: "Chennai",
      status: "Active",
      projectIds: [],
    });
    const project = await Project.create({
      projectId: await generateId("AB"),
      name: "Rejected Collections Project",
      client: client.name,
      clientId: client._id,
      mobile: client.mobile,
      address: client.address,
      supervisor: "Test Supervisor",
      siteIds: [],
      siteNames: [],
      status: "Active",
      startDate: "2026-08-21",
      totalValue: 80_000,
    });

    await request(app)
      .post("/api/payments")
      .set("Authorization", `Bearer ${token}`)
      .send({
        projectId: project._id.toString(),
        clientId: client._id.toString(),
        date: "2026-08-21",
        amount: 20_000,
        mode: "UPI",
        collectedBy: "Test Admin",
      });

    const approval = await Approval.findOne({ type: "payment", projectId: project._id }).lean();
    expect(approval).toBeTruthy();
    const reject = await request(app)
      .put(`/api/approvals/${approval!.approvalId}/reject`)
      .set("Authorization", `Bearer ${token}`);
    expect(reject.status).toBe(200);

    const refreshedProject = await Project.findById(project._id).lean();
    expect(refreshedProject?.receivedAmount).toBe(0);
    expect(refreshedProject?.completion).toBe(0);

    const dashboard = await request(app)
      .get("/api/dashboard/kpis")
      .set("Authorization", `Bearer ${token}`);
    expect(dashboard.body.kpis.financials.totalReceived).toBe(0);
  });
});
