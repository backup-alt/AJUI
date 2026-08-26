import { app } from "./setup";
import { Client } from "../src/models/Client";
import { Project } from "../src/models/Project";
import { Supervisor } from "../src/models/Supervisor";
import { User } from "../src/models/User";
import { createProject } from "../src/services/project.service";
import { getAssignedProjects } from "../src/services/supervisor-mobile.service";
import { generateId } from "../src/services/id-generator.service";

const supervisorEmail = "project-assignment-supervisor@example.test";

afterEach(async () => {
  if (!app) return;
  const user = await User.findOne({ email: supervisorEmail }).lean();
  if (user) {
    await Supervisor.deleteMany({ userId: user._id });
    await User.deleteOne({ _id: user._id });
  }
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
});
