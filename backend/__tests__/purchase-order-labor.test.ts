import request from "supertest";
import { app } from "./setup";
import { Client } from "../src/models/Client";
import { Counter } from "../src/models/Counter";
import { GstRate } from "../src/models/GstRate";
import { Inventory } from "../src/models/Inventory";
import { Material } from "../src/models/Material";
import { Project } from "../src/models/Project";
import { Site } from "../src/models/Site";
import { PurchaseOrder } from "../src/models/PurchaseOrder";
import { Subcontractor } from "../src/models/Subcontractor";
import { SubcontractorLabor } from "../src/models/SubcontractorLabor";
import { Supervisor } from "../src/models/Supervisor";
import { User } from "../src/models/User";
import { Vendor } from "../src/models/Vendor";
import { generateId } from "../src/services/id-generator.service";
import { ensureMaterialInInventory, listInventory } from "../src/services/inventory.service";
import {
  getMaterialDetailForSupervisor,
  listMaterialsForSupervisor,
  updateMaterialReceivedForSupervisor,
} from "../src/services/supervisor-mobile.service";
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
    Site.deleteMany({}),
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
  it("returns every project material even when the app retains a hidden site selection", async () => {
    if (!app) return;
    const { client, project, supervisorUser } = await seedProcurement();
    const [firstSite, secondSite] = await Site.create([
      {
        siteId: await generateId("SITE"),
        name: "North Store",
        projectIds: [project._id],
        status: "Active",
      },
      {
        siteId: await generateId("SITE"),
        name: "South Store",
        projectIds: [project._id],
        status: "Active",
      },
    ]);
    await Project.updateOne(
      { _id: project._id },
      {
        $set: {
          siteIds: [firstSite._id, secondSite._id],
          siteNames: [firstSite.name, secondSite.name],
        },
      }
    );
    for (const [index, site] of [firstSite, secondSite].entries()) {
      const siteMaterial = await Material.create({
        materialId: await generateId("MAT"),
        projectId: project._id,
        projectName: project.name,
        clientId: client._id,
        clientName: client.name,
        siteId: site._id,
        site: site.name,
        name: "Cement",
        unit: "Nos",
        requestedQuantity: 10,
        approvedQuantity: 10,
        purchasedQuantity: 10,
        consumedQuantity: 0,
        requestDate: `2026-08-2${index + 1}`,
        status: "Not Received",
      });
      await ensureMaterialInInventory(siteMaterial._id, supervisorUser._id.toString());
    }

    const result = await listMaterialsForSupervisor(supervisorUser._id.toString(), {
      projectId: project._id.toString(),
      siteId: firstSite._id.toString(),
      status: "Approved",
      view: "materials",
      limit: 25,
    });

    expect(result.materials.map((material) => material.name)).toEqual(
      expect.arrayContaining(["Bricks", "Cement", "Cement"])
    );
    expect(result.materials).toHaveLength(3);

    const cementInventory = await Inventory.find({
      projectId: project._id,
      normalizedName: "cement",
    });
    expect(cementInventory).toHaveLength(2);
    cementInventory[0].consumedQuantity = 2;
    cementInventory[0].consumptionHistory = [{
      quantity: 2,
      date: new Date("2026-08-23T10:00:00.000Z"),
      notes: "North wall",
    }];
    await cementInventory[0].save();
    cementInventory[1].consumedQuantity = 3;
    cementInventory[1].consumptionHistory = [{
      quantity: 3,
      date: new Date("2026-08-24T10:00:00.000Z"),
      notes: "South wall",
    }];
    await cementInventory[1].save();

    const detail = await getMaterialDetailForSupervisor(
      supervisorUser._id.toString(),
      cementInventory[0]._id.toString()
    );
    expect(detail.site).toBe("Multiple sites");
    expect(detail.purchasedQuantity).toBe(20);
    expect(detail.consumedQuantity).toBe(5);
    expect(detail.remainingStock).toBe(15);
    expect(detail.purchaseHistory).toHaveLength(2);
    expect(detail.consumptionHistory).toHaveLength(2);
  });

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

  it("keeps purchase receipts independent and summarizes only the latest web addition", async () => {
    if (!app) return;
    const { project, supervisorUser } = await seedProcurement();
    const createWebMaterial = async (requestDate: string) => {
      const material = await Material.create({
        materialId: await generateId("MAT"),
        projectId: project._id,
        projectName: project.name,
        site: "Main Store",
        name: "Cement",
        unit: "Bag",
        requestedQuantity: 25,
        approvedQuantity: 25,
        purchasedQuantity: 25,
        consumedQuantity: 0,
        requestDate,
        status: "Not Received",
        createdBy: supervisorUser._id.toString(),
      });
      await ensureMaterialInInventory(material._id, supervisorUser._id.toString());
      return material.toObject();
    };
    const older = await createWebMaterial("2026-08-20");
    const latest = await createWebMaterial("2026-08-21");
    // The web createMaterial service executes the same inventory sync after
    // creating each Material document.

    const beforeReceipt = await listMaterialsForSupervisor(supervisorUser._id.toString(), {
      projectId: project._id.toString(),
      status: "Approved",
    });
    const mobileCard = beforeReceipt.materials.find((item) => item.name === "Cement");
    expect(mobileCard).toBeDefined();
    expect(mobileCard?.received).toBe(false);
    expect(mobileCard?.purchaseHistory).toHaveLength(2);

    const hiddenBeforeLatestReceipt = await listMaterialsForSupervisor(supervisorUser._id.toString(), {
      projectId: project._id.toString(),
      status: "Approved",
      receivedOnly: true,
      view: "inventory",
    });
    expect(hiddenBeforeLatestReceipt.materials.find((item) => item.name === "Cement")).toBeUndefined();

    await updateMaterialReceivedForSupervisor(supervisorUser._id.toString(), older._id.toString(), true);

    const afterOlderReceipt = await Inventory.findOne({
      projectId: project._id,
      normalizedName: "cement",
    }).lean();
    expect(afterOlderReceipt?.lastMaterialId?.toString()).toBe(latest._id.toString());
    expect(afterOlderReceipt?.received).toBe(false);
    expect(afterOlderReceipt?.purchaseHistory?.find(
      (entry) => entry.materialId?.toString() === older._id.toString()
    )?.received).toBe(true);
    expect(afterOlderReceipt?.purchaseHistory?.find(
      (entry) => entry.materialId?.toString() === latest._id.toString()
    )?.received).toBe(false);
    expect((await Material.findById(latest._id).lean())?.status).toBe("Not Received");

    const hiddenAfterOlderReceipt = await listMaterialsForSupervisor(supervisorUser._id.toString(), {
      projectId: project._id.toString(),
      status: "Approved",
      receivedOnly: true,
      view: "inventory",
    });
    expect(hiddenAfterOlderReceipt.materials.find((item) => item.name === "Cement")).toBeUndefined();

    const webInventory = await listInventory({
      projectId: project._id.toString(),
      page: 1,
      limit: 25,
    });
    expect(webInventory.items.find((item) => item.name === "Cement")?.received).toBe(false);

    const refreshedMobile = await listMaterialsForSupervisor(supervisorUser._id.toString(), {
      projectId: project._id.toString(),
      status: "Approved",
    });
    const refreshedCard = refreshedMobile.materials.find((item) => item.name === "Cement");
    expect(refreshedCard?.received).toBe(false);
    expect(refreshedCard?.purchaseHistory.find(
      (entry: any) => entry.materialId?.toString() === older._id.toString()
    )?.received).toBe(true);
    expect(refreshedCard?.purchaseHistory.find(
      (entry: any) => entry.materialId?.toString() === latest._id.toString()
    )?.received).toBe(false);

    await updateMaterialReceivedForSupervisor(supervisorUser._id.toString(), latest._id.toString(), true);
    expect((await Inventory.findById(afterOlderReceipt?._id).lean())?.received).toBe(true);

    const visibleAfterLatestReceipt = await listMaterialsForSupervisor(supervisorUser._id.toString(), {
      projectId: project._id.toString(),
      status: "Approved",
      receivedOnly: true,
      view: "inventory",
    });
    expect(visibleAfterLatestReceipt.materials.find((item) => item.name === "Cement")).toBeDefined();
  });

  it("uses the purchase entry id when repeated additions share one material id", async () => {
    if (!app) return;
    const { project, material, supervisorUser } = await seedProcurement();
    const inventory = await Inventory.create({
      projectId: project._id,
      projectName: project.name,
      site: "Main Store",
      name: material.name,
      unit: material.unit,
      requestedQuantity: 20_000,
      approvedQuantity: 20_000,
      purchasedQuantity: 20_000,
      consumedQuantity: 0,
      minimumQuantity: 0,
      lastMaterialId: material._id,
      received: false,
      purchaseHistory: [
        { vendor: "Vendor A", quantity: 10_000, date: new Date("2026-08-20"), materialId: material._id, received: false },
        { vendor: "Vendor A", quantity: 10_000, date: new Date("2026-08-21"), materialId: material._id, received: false },
      ],
    });
    const olderPurchaseId = String((inventory.purchaseHistory?.[0] as any)?._id);

    await updateMaterialReceivedForSupervisor(supervisorUser._id.toString(), olderPurchaseId, true);

    const refreshed = await Inventory.findById(inventory._id).lean();
    expect(refreshed?.purchaseHistory?.[0]?.received).toBe(true);
    expect(refreshed?.purchaseHistory?.[1]?.received).toBe(false);
    expect(refreshed?.received).toBe(false);
    expect((await Material.findById(material._id).lean())?.status).toBe("Not Received");
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
  it("persists GST registration choices for vendors and subcontractors", async () => {
    if (!app) return;
    const { project } = await seedProcurement();

    const vendor = await request(app)
      .post("/api/vendors")
      .set("Authorization", `Bearer ${token}`)
      .send({
        name: "Non GST Vendor",
        materialType: "Sand",
        phone: "+919876500099",
        address: "Chennai",
        gstType: "Non-GST",
      });
    expect(vendor.status).toBe(201);
    expect(vendor.body.vendor.gstType).toBe("Non-GST");

    const subcontractor = await request(app)
      .post("/api/subcontractors")
      .set("Authorization", `Bearer ${token}`)
      .send({
        projectId: project._id.toString(),
        subcontractorName: "GST Contractor",
        gstType: "GST",
        gstNumber: "33aabcs1402p1z8",
      });
    expect(subcontractor.status).toBe(201);
    expect(subcontractor.body.subcontractor.gstType).toBe("GST");
    expect(subcontractor.body.subcontractor.gstNumber).toBe("33AABCS1402P1Z8");
    expect(subcontractor.body.subcontractor.paymentMode).toBeUndefined();

    const missingGstNumber = await request(app)
      .post("/api/subcontractors")
      .set("Authorization", `Bearer ${token}`)
      .send({
        projectId: project._id.toString(),
        subcontractorName: "Invalid GST Contractor",
        gstType: "GST",
      });
    expect(missingGstNumber.status).toBe(400);

    const nonGst = await request(app)
      .post("/api/subcontractors")
      .set("Authorization", `Bearer ${token}`)
      .send({
        projectId: project._id.toString(),
        subcontractorName: "Non GST Contractor",
        gstType: "Non-GST",
        gstNumber: "SHOULD-BE-CLEARED",
      });
    expect(nonGst.status).toBe(201);
    expect(nonGst.body.subcontractor.gstType).toBe("Non-GST");
    expect(nonGst.body.subcontractor.gstNumber).toBe("");
  });

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
