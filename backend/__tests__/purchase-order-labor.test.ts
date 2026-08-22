import request from "supertest";
import { app } from "./setup";
import { Client } from "../src/models/Client";
import { Counter } from "../src/models/Counter";
import { GstRate } from "../src/models/GstRate";
import { Inventory } from "../src/models/Inventory";
import { Material } from "../src/models/Material";
import { Project } from "../src/models/Project";
import { PurchaseOrder } from "../src/models/PurchaseOrder";
import { Subcontractor } from "../src/models/Subcontractor";
import { SubcontractorLabor } from "../src/models/SubcontractorLabor";
import { Supervisor } from "../src/models/Supervisor";
import { User } from "../src/models/User";
import { Vendor } from "../src/models/Vendor";
import { generateId } from "../src/services/id-generator.service";
import { listMaterialsForSupervisor } from "../src/services/supervisor-mobile.service";
import { hashPassword } from "../src/utils/password";

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
    PurchaseOrder.deleteMany({}),
    Material.deleteMany({}),
    Inventory.deleteMany({}),
    Vendor.deleteMany({}),
    Project.deleteMany({}),
    Client.deleteMany({}),
    SubcontractorLabor.deleteMany({}),
    Subcontractor.deleteMany({}),
    Supervisor.deleteMany({}),
    User.deleteMany({ role: "supervisor" }),
    GstRate.deleteMany({}),
    Counter.deleteMany({}),
  ]);
});

async function seedProcurement() {
  const client = await Client.create({
    clientId: await generateId("CLI"),
    name: "PO Client",
    mobile: "+919876500010",
    address: "Chennai",
    status: "Active",
    projectIds: [],
  });
  const project = await Project.create({
    projectId: await generateId("AB"),
    name: "PO Project",
    client: client.name,
    clientId: client._id,
    mobile: client.mobile,
    address: client.address,
    supervisor: "Supervisor",
    siteIds: [],
    siteNames: [],
    status: "Active",
    startDate: "2026-08-01",
    totalValue: 100000,
  });
  const vendor = await Vendor.create({
    vendorId: await generateId("VEN"),
    name: "PO Vendor",
    materialType: "General",
    phone: "+919876500011",
    address: "Chennai",
    status: "Active",
    siteIds: [],
  });
  const material = await Material.create({
    materialId: await generateId("MAT"),
    projectId: project._id,
    projectName: project.name,
    clientId: client._id,
    clientName: client.name,
    site: "",
    name: "Bricks",
    unit: "Nos",
    requestedQuantity: 10000,
    approvedQuantity: 10000,
    purchasedQuantity: 0,
    consumedQuantity: 0,
    requestDate: "2026-08-01",
    status: "Not Received",
  });
  const supervisorUser = await User.create({
    name: "PO Supervisor",
    email: "po-supervisor@test.com",
    phone: "+919876500013",
    passwordHash: await hashPassword("TestPass123"),
    role: "supervisor",
    status: "active",
  });
  const supervisor = await Supervisor.create({
    supervisorId: await generateId("SUP"),
    userId: supervisorUser._id,
    name: supervisorUser.name,
    email: supervisorUser.email,
    phone: supervisorUser.phone,
    assignedProjectId: project._id,
    assignedProjects: [project._id],
    assignedSites: [],
    assignedSiteIds: [],
    status: "Active",
  });
  supervisorUser.supervisorProfileId = supervisor._id;
  await supervisorUser.save();
  return { client, project, vendor, material, supervisorUser };
}

describe("Purchase order workflow", () => {
  it("syncs the supervisor received checkbox to inventory and the web material status", async () => {
    if (!app) return;
    const { project, material, supervisorUser } = await seedProcurement();
    const inventory = await Inventory.create({
      projectId: project._id,
      projectName: project.name,
      site: "Project storage",
      name: material.name,
      unit: material.unit,
      requestedQuantity: material.requestedQuantity,
      approvedQuantity: material.approvedQuantity,
      purchasedQuantity: material.approvedQuantity,
      consumedQuantity: 0,
      minimumQuantity: 0,
      lastMaterialId: material._id,
    });
    const supervisorLogin = await request(app).post("/api/auth/login").send({
      phone: supervisorUser.phone,
      password: "TestPass123",
    });

    const markReceived = await request(app)
      .patch(`/api/supervisor/materials/${inventory._id}/received`)
      .set("Authorization", `Bearer ${supervisorLogin.body.accessToken}`)
      .send({ received: true });

    expect(markReceived.status).toBe(200);
    expect(markReceived.body.material.received).toBe(true);
    expect((await Inventory.findById(inventory._id).lean())?.received).toBe(true);
    expect((await Material.findById(material._id).lean())?.status).toBe("Received");

    const undoReceived = await request(app)
      .patch(`/api/supervisor/materials/${inventory._id}/received`)
      .set("Authorization", `Bearer ${supervisorLogin.body.accessToken}`)
      .send({ received: false });

    expect(undoReceived.status).toBe(409);
    expect((await Inventory.findById(inventory._id).lean())?.received).toBe(true);
    expect((await Material.findById(material._id).lean())?.status).toBe("Received");
  });

  it("persists a readable PO, allocates full approved quantity, and creates manual project materials", async () => {
    if (!app) return;
    const { project, vendor, material, supervisorUser } = await seedProcurement();
    const response = await request(app)
      .post("/api/purchase-orders")
      .set("Authorization", `Bearer ${token}`)
      .send({
        projectId: project._id.toString(),
        vendorId: vendor._id.toString(),
        date: "2026-08-13",
        roundOff: -0.25,
        items: [
          { source: "existing", materialId: material._id.toString(), rate: 8, gstPercent: 5 },
          { source: "manual", description: "PVC Pipe", unit: "Nos", quantity: 50, rate: 500, gstPercent: 18 },
        ],
      });

    expect(response.status).toBe(201);
    expect(response.body.purchaseOrder.poNumber).toMatch(/^PO-\d{4}-\d{4}$/);
    expect(response.body.purchaseOrder.items[0].quantity).toBe(10000);
    expect(response.body.purchaseOrder.vendorId).toBe(vendor._id.toString());

    const allocated = await Material.findById(material._id).lean();
    expect(allocated?.poNumber).toBe(response.body.purchaseOrder.poNumber);
    const manual = await Material.findOne({ projectId: project._id, name: "PVC Pipe" }).lean();
    expect(manual?.approvedQuantity).toBe(50);
    expect(manual?.poNumber).toBe(response.body.purchaseOrder.poNumber);

    const mobileMaterials = await listMaterialsForSupervisor(supervisorUser._id.toString(), {
      projectId: project._id.toString(),
      status: "Approved",
      limit: 25,
    });
    expect(mobileMaterials.materials).toEqual(expect.arrayContaining([
      expect.objectContaining({ name: "PVC Pipe", poNumber: response.body.purchaseOrder.poNumber }),
    ]));

    const detail = await request(app)
      .get(`/api/purchase-orders/${response.body.purchaseOrder.poNumber}`)
      .set("Authorization", `Bearer ${token}`);
    expect(detail.status).toBe(200);
    expect(detail.body.purchaseOrder.items).toHaveLength(2);

    const duplicate = await request(app)
      .post("/api/purchase-orders")
      .set("Authorization", `Bearer ${token}`)
      .send({
        projectId: project._id.toString(),
        vendorId: vendor._id.toString(),
        date: "2026-08-13",
        items: [{ source: "existing", materialId: material._id.toString(), rate: 8, gstPercent: 5 }],
      });
    expect(duplicate.status).toBe(409);
  });

  it("persists custom GST rates", async () => {
    if (!app) return;
    const create = await request(app)
      .post("/api/purchase-orders/gst-rates")
      .set("Authorization", `Bearer ${token}`)
      .send({ rate: 7.5 });
    expect(create.status).toBe(201);
    const list = await request(app)
      .get("/api/purchase-orders/gst-rates")
      .set("Authorization", `Bearer ${token}`);
    expect(list.status).toBe(200);
    expect(list.body.rates).toContain(7.5);
  });

  it("edits a purchase order, re-allocates materials, and frees removed ones", async () => {
    if (!app) return;
    const { project, vendor, material, supervisorUser } = await seedProcurement();
    const secondMaterial = await Material.create({
      materialId: await generateId("MAT"),
      projectId: project._id,
      projectName: project.name,
      clientId: project.clientId,
      clientName: project.clientName,
      site: "",
      name: "Cement",
      unit: "Bags",
      requestedQuantity: 200,
      approvedQuantity: 200,
      purchasedQuantity: 0,
      consumedQuantity: 0,
      requestDate: "2026-08-01",
      status: "Not Received",
    });
    const vendor2 = await Vendor.create({
      vendorId: await generateId("VEN"),
      name: "PO Vendor 2",
      materialType: "General",
      phone: "+919876500014",
      address: "Chennai",
      status: "Active",
      siteIds: [],
    });

    const createResponse = await request(app)
      .post("/api/purchase-orders")
      .set("Authorization", `Bearer ${token}`)
      .send({
        projectId: project._id.toString(),
        vendorId: vendor._id.toString(),
        date: "2026-08-13",
        items: [
          { source: "existing", materialId: material._id.toString(), rate: 8, gstPercent: 5 },
          { source: "manual", description: "PVC Pipe", unit: "Nos", quantity: 50, rate: 500, gstPercent: 18 },
        ],
      });
    expect(createResponse.status).toBe(201);
    const po = createResponse.body.purchaseOrder;
    const manualMaterial = await Material.findOne({ projectId: project._id, name: "PVC Pipe" }).lean();

    const updateResponse = await request(app)
      .put(`/api/purchase-orders/${po._id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({
        vendorId: vendor2._id.toString(),
        date: "2026-08-14",
        roundOff: 0.5,
        items: [
          { source: "existing", materialId: secondMaterial._id.toString(), rate: 310, gstPercent: 18 },
          { source: "manual", materialId: manualMaterial!._id.toString(), description: "PVC Pipe 4inch", unit: "Meters", quantity: 60, rate: 520, gstPercent: 12 },
        ],
      });
    expect(updateResponse.status).toBe(200);
    const updated = updateResponse.body.purchaseOrder;
    expect(updated.vendorName).toBe("PO Vendor 2");
    expect(updated.date).toBe("2026-08-14");
    expect(updated.items).toHaveLength(2);
    expect(updated.items[1].quantity).toBe(60);
    expect(updated.items[1].unit).toBe("Meters");
    expect(updated.grandTotal).toBeCloseTo(310 * 200 + 310 * 200 * 0.18 + 60 * 520 + 60 * 520 * 0.12 + 0.5, 2);

    const freed = await Material.findById(material._id).lean();
    expect(String(freed?.poNumber || "")).toBe("");
    const newlyClaimed = await Material.findById(secondMaterial._id).lean();
    expect(newlyClaimed?.poNumber).toBe(po.poNumber);
    const renamed = await Material.findById(manualMaterial!._id).lean();
    expect(renamed?.name).toBe("PVC Pipe 4inch");
    expect(renamed?.approvedQuantity).toBe(60);

    const detail = await request(app)
      .get(`/api/purchase-orders/${po.poNumber}`)
      .set("Authorization", `Bearer ${token}`);
    expect(detail.status).toBe(200);
    expect(detail.body.purchaseOrder.items[0].materialId).toBe(secondMaterial._id.toString());
    expect(supervisorUser).toBeTruthy();
  });
});

describe("Subcontractor labor roster", () => {
  it("supports add and edit without exposing delete", async () => {
    if (!app) return;
    const { client, project } = await seedProcurement();
    const subcontractor = await Subcontractor.create({
      projectId: project._id,
      projectName: project.name,
      clientId: client._id,
      subcontractorName: "Labor Contractor",
      status: "active",
    });
    const create = await request(app)
      .post("/api/subcontractor-labor")
      .set("Authorization", `Bearer ${token}`)
      .send({
        subcontractorId: subcontractor._id.toString(),
        name: "Worker One",
        address: "",
        phone: "+919876500012",
        role: "Mason",
        notes: "Day shift",
      });
    expect(create.status).toBe(201);
    const id = create.body.labor._id;

    const update = await request(app)
      .patch(`/api/subcontractor-labor/${id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ role: "Civil Worker" });
    expect(update.status).toBe(200);
    expect(update.body.labor.role).toBe("Civil Worker");

    const list = await request(app)
      .get(`/api/subcontractor-labor?subcontractorId=${subcontractor._id}`)
      .set("Authorization", `Bearer ${token}`);
    expect(list.status).toBe(200);
    expect(list.body.items).toHaveLength(1);

    const deleteAttempt = await request(app)
      .delete(`/api/subcontractor-labor/${id}`)
      .set("Authorization", `Bearer ${token}`);
    expect(deleteAttempt.status).toBe(404);
  });
});
