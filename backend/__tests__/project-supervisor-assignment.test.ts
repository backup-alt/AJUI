import { app } from "./setup";
import { Client } from "../src/models/Client";
import { Project } from "../src/models/Project";
import { Site } from "../src/models/Site";
import { Supervisor } from "../src/models/Supervisor";
import { User } from "../src/models/User";
import { createProject } from "../src/services/project.service";
import { generateId } from "../src/services/id-generator.service";

const supervisorEmail = "project-assignment-supervisor@example.test";

afterEach(async () => {
  if (!app) return;
  const user = await User.findOne({ email: supervisorEmail }).lean();
  if (user) {
    await Supervisor.deleteMany({ userId: user._id });
    await User.deleteOne({ _id: user._id });
  }
  await Site.deleteMany({ name: "Assignment Test Site" });
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

    const project = await createProject({
      name: "Supervisor Assignment Project",
      clientId: client._id.toString(),
      mobile: client.mobile,
      address: client.address,
      supervisor: supervisorUser.name,
      supervisorId: supervisorUser._id.toString(),
      sites: ["Assignment Test Site"],
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
    const site = await Site.findOne({ name: "Assignment Test Site" }).lean();

    expect(profile).not.toBeNull();
    expect(String(project.supervisorId)).toBe(String(supervisorProfile._id));
    expect(profile!.assignedProjects.map(String)).toContain(String(project._id));
    expect(refreshedUser!.managedProjectIds.map(String)).toContain(String(project._id));
    expect(String(site!.supervisorId)).toBe(String(profile!._id));
  });
});
