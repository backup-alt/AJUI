import { app } from "./setup";
import request from "supertest";
import { Client } from "../src/models/Client";
import { Project } from "../src/models/Project";
import { Supervisor } from "../src/models/Supervisor";
import { User } from "../src/models/User";
import { Site } from "../src/models/Site";
import { Expense } from "../src/models/Expense";
import { Approval } from "../src/models/Approval";
import { createProject, updateProject } from "../src/services/project.service";
import { getAssignedProjects } from "../src/services/supervisor-mobile.service";
import { generateId } from "../src/services/id-generator.service";
import { hashPassword } from "../src/utils/password";

const supervisorEmail = "project-assignment-supervisor@example.test";
const secondSupervisorEmail = "project-assignment-supervisor-b@example.test";

afterEach(async () => {
  if (!app) return;
  const users = await User.find({
    email: { $in: [supervisorEmail, secondSupervisorEmail] },
  }).lean();
  if (users.length) {
    await Supervisor.deleteMany({
      $or: [
        { userId: { $in: users.map((user) => user._id) } },
        { email: { $in: [supervisorEmail, secondSupervisorEmail] } },
      ],
    });
    await User.deleteMany({ _id: { $in: users.map((user) => user._id) } });
  }
  const projects = await Project.find({ name: "Supervisor Assignment Project" }).select("_id").lean();
  const projectIds = projects.map((project) => project._id);
  await Expense.deleteMany({ projectId: { $in: projectIds } });
  await Approval.deleteMany({ projectId: { $in: projectIds } });
  await Site.deleteMany({ name: "Supervisor Assignment Site" });
  await Project.deleteMany({ name: "Supervisor Assignment Project" });
  await Client.deleteMany({ name: "Supervisor Assignment Client" });
});

describe("Project supervisor assignment", () => {
  it("accepts the supervisor User id and synchronizes the project scope", async () => {
    if (!app) return;

    const supervisorUser = await User.create({
      name: "Assignment Supervisor",
      email: supervisorEmail,
      phone: "+919876509991",
      passwordHash: "not-used-by-this-test",
      role: "supervisor",
      status: "active",
      managedProjectIds: [],
    });
    const supervisorProfile = await Supervisor.create({
      supervisorId: `SUP-ASSIGN-${supervisorUser._id.toString().slice(-8)}`,
      userId: supervisorUser._id,
      name: supervisorUser.name,
      email: supervisorUser.email,
      phone: supervisorUser.phone,
      role: "Project Supervisor",
      assignedProjects: [],
      assignedSiteIds: [],
      assignedSites: [],
      status: "Active",
    });
    supervisorUser.supervisorProfileId = supervisorProfile._id;
    await supervisorUser.save();
    const client = await Client.create({
      clientId: await generateId("CLI"),
      name: "Supervisor Assignment Client",
      mobile: "+919876509992",
      address: "Chennai",
      status: "Active",
      projectIds: [],
    });

    // Reproduce an already-open mobile app that cached an empty access scope
    // before the admin created and assigned the project.
    expect(await getAssignedProjects(supervisorUser._id.toString())).toEqual([]);

    const project = await createProject({
      name: "Supervisor Assignment Project",
      clientId: client._id.toString(),
      mobile: client.mobile,
      address: client.address,
      supervisor: supervisorUser.name,
      supervisorId: supervisorUser._id.toString(),
      sites: [],
      siteIds: [],
      status: "Active",
      startDate: "2026-08-26",
      totalValue: 100_000,
      estimatedValue: 0,
      advanceAmount: 0,
      receivedAmount: 0,
      materialSpend: 0,
      labourPayable: 0,
      expenseBalance: 0,
      completion: 0,
    });

    const profile = await Supervisor.findOne({ userId: supervisorUser._id }).lean();
    const refreshedUser = await User.findById(supervisorUser._id).lean();
    const mobileProjects = await getAssignedProjects(supervisorUser._id.toString());

    expect(profile).not.toBeNull();
    expect(String(project.supervisorId)).toBe(String(supervisorProfile._id));
    expect(profile!.assignedProjects.map(String)).toContain(String(project._id));
    expect(refreshedUser!.managedProjectIds.map(String)).toContain(String(project._id));
    expect(mobileProjects.map((row) => row.id)).toContain(String(project._id));
  });

  it("repairs a legacy supervisor link and reconciles an unchanged edit assignment", async () => {
    if (!app) return;

    const supervisorUser = await User.create({
      name: "Assignment Supervisor",
      email: supervisorEmail,
      phone: "+919876509991",
      passwordHash: "not-used-by-this-test",
      role: "supervisor",
      status: "active",
      managedProjectIds: [],
    });
    const legacyProfile = await Supervisor.create({
      supervisorId: `SUP-LEGACY-${supervisorUser._id.toString().slice(-8)}`,
      name: supervisorUser.name,
      email: supervisorUser.email,
      phone: supervisorUser.phone,
      role: "Project Supervisor",
      assignedProjects: [],
      assignedSiteIds: [],
      assignedSites: [],
      status: "Active",
    });
    supervisorUser.supervisorProfileId = legacyProfile._id;
    await supervisorUser.save();

    const client = await Client.create({
      clientId: await generateId("CLI"),
      name: "Supervisor Assignment Client",
      mobile: "+919876509992",
      address: "Chennai",
      status: "Active",
      projectIds: [],
    });
    const project = await Project.create({
      projectId: await generateId("AB"),
      name: "Supervisor Assignment Project",
      client: client.name,
      clientId: client._id,
      mobile: client.mobile,
      address: client.address,
      supervisor: supervisorUser.name,
      supervisorId: legacyProfile._id,
      siteIds: [],
      siteNames: [],
      status: "Active",
      startDate: "2026-08-26",
      totalValue: 100_000,
    });

    await updateProject(project._id.toString(), {
      supervisor: supervisorUser.name,
      supervisorId: supervisorUser._id.toString(),
    });

    const repairedProfile = await Supervisor.findById(legacyProfile._id).lean();
    const refreshedUser = await User.findById(supervisorUser._id).lean();

    expect(String(repairedProfile?.userId)).toBe(String(supervisorUser._id));
    expect(repairedProfile?.assignedProjects.map(String)).toContain(String(project._id));
    expect(refreshedUser?.managedProjectIds.map(String)).toContain(String(project._id));
  });

  it("creates and reassigns through HTTP, removing old mobile access immediately", async () => {
    if (!app) return;

    const passwordHash = await hashPassword("TestPass123");
    const [firstUser, secondUser] = await User.create([
      {
        name: "Assignment Supervisor A",
        email: supervisorEmail,
        phone: "+919876509991",
        passwordHash,
        role: "supervisor",
        status: "active",
        managedProjectIds: [],
      },
      {
        name: "Assignment Supervisor B",
        email: secondSupervisorEmail,
        phone: "+919876509993",
        passwordHash,
        role: "supervisor",
        status: "active",
        managedProjectIds: [],
      },
    ]);
    const [firstProfile, secondProfile] = await Supervisor.create([
      {
        supervisorId: `SUP-A-${firstUser._id.toString().slice(-8)}`,
        userId: firstUser._id,
        name: firstUser.name,
        email: firstUser.email,
        phone: firstUser.phone,
        role: "Project Supervisor",
        assignedProjects: [],
        assignedSiteIds: [],
        assignedSites: [],
        status: "Active",
      },
      {
        supervisorId: `SUP-B-${secondUser._id.toString().slice(-8)}`,
        userId: secondUser._id,
        name: secondUser.name,
        email: secondUser.email,
        phone: secondUser.phone,
        role: "Project Supervisor",
        assignedProjects: [],
        assignedSiteIds: [],
        assignedSites: [],
        status: "Active",
      },
    ]);
    firstUser.supervisorProfileId = firstProfile._id;
    secondUser.supervisorProfileId = secondProfile._id;
    await Promise.all([firstUser.save(), secondUser.save()]);

    const client = await Client.create({
      clientId: await generateId("CLI"),
      name: "Supervisor Assignment Client",
      mobile: "+919876509992",
      address: "Chennai",
      status: "Active",
      projectIds: [],
    });

    const adminLogin = await request(app).post("/api/auth/login").send({
      email: "admin@test.com",
      password: "TestPass123",
    });
    expect(adminLogin.status).toBe(200);
    const adminToken = adminLogin.body.accessToken as string;

    const created = await request(app)
      .post("/api/projects")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        name: "Supervisor Assignment Project",
        clientId: client._id.toString(),
        mobile: client.mobile,
        address: client.address,
        supervisor: firstUser.name,
        supervisorId: firstUser._id.toString(),
        siteIds: [],
        sites: [],
        status: "Active",
        startDate: "2026-08-26",
        totalValue: 100_000,
      });
    expect(created.status).toBe(201);
    const projectId = String(created.body.project._id);

    const loginSupervisor = async (phone: string) => {
      const response = await request(app).post("/api/auth/login").send({
        phone,
        password: "TestPass123",
      });
      expect(response.status).toBe(200);
      return response.body.accessToken as string;
    };
    const [firstToken, secondToken] = await Promise.all([
      loginSupervisor(firstUser.phone),
      loginSupervisor(secondUser.phone),
    ]);

    const employeesAfterCreate = await request(app)
      .get("/api/admin/users?role=supervisor&limit=100")
      .set("Authorization", `Bearer ${adminToken}`);
    const firstEmployee = employeesAfterCreate.body.items.find(
      (item: { _id: string }) => item._id === firstUser._id.toString(),
    );
    expect(firstEmployee.managedProjectIds.map(String)).toContain(projectId);

    const firstMobileBefore = await request(app)
      .get("/api/supervisor/projects")
      .set("Authorization", `Bearer ${firstToken}`);
    const secondMobileBefore = await request(app)
      .get("/api/supervisor/projects")
      .set("Authorization", `Bearer ${secondToken}`);
    expect(firstMobileBefore.body.projects.map((project: { id: string }) => project.id)).toContain(projectId);
    expect(secondMobileBefore.body.projects.map((project: { id: string }) => project.id)).not.toContain(projectId);

    const reassigned = await request(app)
      .patch(`/api/projects/${projectId}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        supervisor: secondUser.name,
        supervisorId: secondUser._id.toString(),
      });
    expect(reassigned.status).toBe(200);

    const employeesAfterEdit = await request(app)
      .get("/api/admin/users?role=supervisor&limit=100")
      .set("Authorization", `Bearer ${adminToken}`);
    const refreshedFirstEmployee = employeesAfterEdit.body.items.find(
      (item: { _id: string }) => item._id === firstUser._id.toString(),
    );
    const refreshedSecondEmployee = employeesAfterEdit.body.items.find(
      (item: { _id: string }) => item._id === secondUser._id.toString(),
    );
    expect(refreshedFirstEmployee.managedProjectIds.map(String)).not.toContain(projectId);
    expect(refreshedSecondEmployee.managedProjectIds.map(String)).toContain(projectId);

    const firstMobileAfter = await request(app)
      .get("/api/supervisor/projects")
      .set("Authorization", `Bearer ${firstToken}`);
    const secondMobileAfter = await request(app)
      .get("/api/supervisor/projects")
      .set("Authorization", `Bearer ${secondToken}`);
    expect(firstMobileAfter.body.projects.map((project: { id: string }) => project.id)).not.toContain(projectId);
    expect(secondMobileAfter.body.projects.map((project: { id: string }) => project.id)).toContain(projectId);

    const oldProfile = await Supervisor.findById(firstProfile._id).lean();
    expect(oldProfile?.assignedProjects.map(String)).not.toContain(projectId);
    expect(String(oldProfile?.assignedProjectId || "")).not.toBe(projectId);
  });

  it("lets an admin add an opening amount and later cash directly to the mobile ledger", async () => {
    if (!app) return;

    const passwordHash = await hashPassword("TestPass123");
    const supervisorUser = await User.create({
      name: "Assignment Supervisor",
      email: supervisorEmail,
      phone: "+919876509991",
      passwordHash,
      role: "supervisor",
      status: "active",
      managedProjectIds: [],
    });
    const supervisorProfile = await Supervisor.create({
      supervisorId: `SUP-FUND-${supervisorUser._id.toString().slice(-8)}`,
      userId: supervisorUser._id,
      name: supervisorUser.name,
      email: supervisorUser.email,
      phone: supervisorUser.phone,
      role: "Project Supervisor",
      assignedProjects: [],
      assignedSiteIds: [],
      assignedSites: [],
      status: "Active",
    });
    supervisorUser.supervisorProfileId = supervisorProfile._id;
    await supervisorUser.save();

    const client = await Client.create({
      clientId: await generateId("CLI"),
      name: "Supervisor Assignment Client",
      mobile: "+919876509992",
      address: "Chennai",
      status: "Active",
      projectIds: [],
    });
    const project = await Project.create({
      projectId: await generateId("AB"),
      name: "Supervisor Assignment Project",
      client: client.name,
      clientId: client._id,
      mobile: client.mobile,
      address: client.address,
      supervisor: supervisorProfile.name,
      supervisorId: supervisorProfile._id,
      siteIds: [],
      siteNames: [],
      status: "Active",
      startDate: "2026-08-27",
      totalValue: 100_000,
    });
    const site = await Site.create({
      siteId: await generateId("SITE"),
      name: "Supervisor Assignment Site",
      supervisor: supervisorProfile.name,
      supervisorId: supervisorProfile._id,
      projectIds: [project._id],
      openingBalance: 0,
      status: "Active",
    });
    project.siteIds = [site._id];
    project.siteNames = [site.name];
    await project.save();
    supervisorProfile.assignedProjectId = project._id;
    supervisorProfile.assignedProjects = [project._id];
    supervisorProfile.assignedSiteId = site._id;
    supervisorProfile.assignedSiteIds = [site._id];
    supervisorProfile.assignedSites = [site.name];
    await supervisorProfile.save();
    supervisorUser.managedProjectIds = [project._id];
    await supervisorUser.save();

    const adminLogin = await request(app).post("/api/auth/login").send({
      email: "admin@test.com",
      password: "TestPass123",
    });
    const adminToken = adminLogin.body.accessToken as string;
    const supervisorLogin = await request(app).post("/api/auth/login").send({
      phone: supervisorUser.phone,
      password: "TestPass123",
    });
    const supervisorToken = supervisorLogin.body.accessToken as string;

    const opening = await request(app)
      .post(`/api/supervisors/${supervisorProfile._id}/fund`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ projectId: project._id.toString(), siteId: site._id.toString(), amount: 5_000 });
    expect(opening.status).toBe(201);
    expect(opening.body.funding.kind).toBe("opening");
    expect((await Site.findById(site._id).lean())?.openingBalance).toBe(5_000);
    expect(await Expense.countDocuments({ projectId: project._id })).toBe(0);

    const mobileSites = await request(app)
      .get("/api/supervisor/sites")
      .set("Authorization", `Bearer ${supervisorToken}`);
    expect(mobileSites.body.sites.find((row: { id: string }) => row.id === site._id.toString())?.openingBalance).toBe(5_000);

    const cash = await request(app)
      .post(`/api/supervisors/${supervisorProfile._id}/fund`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ projectId: project._id.toString(), siteId: site._id.toString(), amount: 2_000, note: "Admin top-up" });
    expect(cash.status).toBe(201);
    expect(cash.body.funding.kind).toBe("cash");
    const cashExpense = await Expense.findById(cash.body.funding.expense._id).lean();
    expect(cashExpense?.status).toBe("Approved");
    expect(cashExpense?.runningBalance).toBe(7_000);
    expect(await Approval.countDocuments({ sourceId: cashExpense?._id })).toBe(0);

    const mobileExpenses = await request(app)
      .get(`/api/supervisor/expenses?projectId=${project._id}&siteId=${site._id}&type=site`)
      .set("Authorization", `Bearer ${supervisorToken}`);
    expect(mobileExpenses.status).toBe(200);
    expect(mobileExpenses.body.expenses.some((row: { _id: string }) => row._id === cashExpense?._id.toString())).toBe(true);
  });
});
