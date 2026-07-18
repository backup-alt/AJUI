import { Injectable, computed, effect, inject, signal } from "@angular/core";
import {
  expenses,
  labour,
  materials,
  payments,
  projects,
  type ExpenseRow,
  type LabourRow,
  type MaterialRow,
  type PaymentRow,
  type Project,
  type ProjectStatus,
  type Quotation,
  type QuotationRow,
  type CompanyProfile,
} from "../../data/dashboardData";
import { CustomFieldsService } from "../core/custom-fields.service";
import { MaterialsService } from "../core/materials.service";
import { ApiService } from "../core/api.service";
import type { CustomField as ApiCustomField } from "../core/custom-fields.service";

export type ClientStatus = "Active" | "On Hold" | "Completed";

export type Client = {
  id: string;
  initials: string;
  name: string;
  mobile: string;
  address: string;
  status: ClientStatus;
  projectIds: string[];
  supervisor: string;
  _id?: string;
};

export type VendorStatus = "Active" | "Not Active";

export type Vendor = {
  id: string;
  name: string;
  materialType: string;
  phone: string;
  address: string;
  gst: string;
  status?: VendorStatus;
  _id?: string;
  siteIds?: string[];
};

export type Supervisor = {
  id: string;
  name: string;
  phone: string;
  role: string;
  assignedProject: string;
  assignedSite: string;
  cashLimit: number;
  activeAdvances: number;
  approvalAuthority: string;
  status: "Active" | "On Leave" | "Inactive";
  _id?: string;
};

export type Subcontractor = {
  id: string;
  projectId: string;
  site: string;
  name: string;
  workPackage: string;
  contractValue: number;
  advancePaid: number;
  startDate: string;
  dueDate: string;
  supervisor: string;
  approvalStatus: "Pending" | "Approved" | "Rejected";
  paymentStatus: "Not Started" | "Part Paid" | "Paid";
  _id?: string;
};

export type Site = {
  id: string;
  name: string;
  status: "Active" | "On Hold" | "Completed";
  projectId?: string;
  materialEntryCount?: number;
  materialNames?: string[];
};

export type AppUser = {
  id: string;
  name: string;
  email: string;
  phone?: string;
  role: "Admin" | "Project Manager" | "Accountant" | "Supervisor";
  status: "active" | "inactive" | "on_leave";
  lastLoginAt?: string;
  createdAt: string;
  projectIds?: string[];
  source?: "admin" | "supervisor" | "employee";
};

export type SharedModuleKey =
  | "materials"
  | "clients"
  | "labour"
  | "expenses"
  | "generalExpenses"
  | "payments"
  | "vendors"
  | "supervisors"
  | "subcontractors"
  | "inventory"
  | "reports"
  | "settings";
export type SharedFieldType = "text" | "number" | "date";
export type SharedTableField = { key: string; label: string; type?: SharedFieldType; afterKey?: string };
export type SharedTableRow = Record<string, string | number | undefined>;
export const managedRoleNames = ["Project Manager", "Accountant", "Supervisor"] as const;
export type ManagedRole = (typeof managedRoleNames)[number];
export type RolePermissionLevel = "hidden" | "read" | "write" | "edit";
export type RoleOption = {
  id: string;
  role: ManagedRole;
  label: string;
};
export type ErpSettings = {
  singleApprovalForSiteExpenseMaterials: boolean;
  roleOptions: RoleOption[];
  rolePermissions: Record<ManagedRole, Record<string, RolePermissionLevel>>;
};

@Injectable({ providedIn: "root" })
export class ErpDataService {
  private readonly customFieldsService = inject(CustomFieldsService);
  private readonly materialsService = inject(MaterialsService);
  private readonly api = inject(ApiService);
  private readonly recoveredTablePresentationState = this.recoverTablePresentationState();

  private readonly _syncMaterials = effect(() => {
    const rows = this.materialsService.materials();
    if (rows && rows.length) {
      this.materials.set(rows);
    }
  });

  readonly clients = signal<Client[]>(
    this.readState<Client[]>("clients", [
    {
      id: "CL-1001",
      initials: "MR",
      name: "Meenakshi Raman",
      mobile: "+91 98402 11880",
      address: "Plot 42, Velachery Main Road, Chennai",
      status: "Active",
      projectIds: ["AB-1024", "AB-1031"],
      supervisor: "R. Karthik",
    },
    {
      id: "CL-1002",
      initials: "DC",
      name: "Dhanraj & Co",
      mobile: "+91 97911 40590",
      address: "Second Avenue, Anna Nagar, Chennai",
      status: "Active",
      projectIds: ["AB-1031"],
      supervisor: "S. Prabhu",
    },
    {
      id: "CL-1003",
      initials: "AS",
      name: "Arun Subramani",
      mobile: "+91 98840 77012",
      address: "Lakshmi Nagar, Porur, Chennai",
      status: "On Hold",
      projectIds: ["AB-1008"],
      supervisor: "M. Saravanan",
    },
    {
      id: "CL-1004",
      initials: "VT",
      name: "Vikram Traders",
      mobile: "+91 76543 21098",
      address: "Commercial Complex, Mount Road, Chennai",
      status: "Completed",
      projectIds: ["AB-1008"],
      supervisor: "M. Saravanan",
    },
    {
      id: "CL-1005",
      initials: "SR",
      name: "Sridhar Residency",
      mobile: "+91 94444 70112",
      address: "OMR Link Road, Sholinganallur, Chennai",
      status: "Active",
      projectIds: ["AB-1024"],
      supervisor: "R. Karthik",
    },
    {
      id: "CL-1006",
      initials: "LN",
      name: "Lakshmi Nagar Trust",
      mobile: "+91 98840 55321",
      address: "Community Hall Street, Porur, Chennai",
      status: "Completed",
      projectIds: ["AB-1008"],
      supervisor: "M. Saravanan",
    },
    ]),
  );

  readonly projects = signal<Project[]>(this.readState<Project[]>("projects", projects));
  readonly materials = signal<MaterialRow[]>(this.readState<MaterialRow[]>("materials", materials));
  readonly labour = signal<LabourRow[]>(this.readState<LabourRow[]>("labour", labour));
  readonly expenses = signal<ExpenseRow[]>(this.readState<ExpenseRow[]>("expenses", []));
  readonly payments = signal<PaymentRow[]>(this.readState<PaymentRow[]>("payments", payments));
  readonly vendors = signal<Vendor[]>(
    this.readState<Vendor[]>("vendors", [
    {
      id: "VEN-101",
      name: "Sri Devi Traders",
      materialType: "Bricks",
      phone: "+91 98410 22001",
      address: "Velachery, Chennai",
      gst: "33AABCS1402P1Z8",
      status: "Active",
    },
    {
      id: "VEN-102",
      name: "KMS Agencies",
      materialType: "Cement",
      phone: "+91 98411 40222",
      address: "Guindy, Chennai",
      gst: "33AAKFK9902L1Z4",
      status: "Active",
    },
    {
      id: "VEN-103",
      name: "Amman Steel",
      materialType: "Steel",
      phone: "+91 99620 88910",
      address: "Ambattur, Chennai",
      gst: "33AABFA8821M1Z2",
      status: "Active",
    },
    {
      id: "VEN-104",
      name: "Thirumalai Blue Metals",
      materialType: "M-Sand",
      phone: "+91 94440 70115",
      address: "Poonamallee, Chennai",
      gst: "33AABFT4021K1Z9",
      status: "Active",
    },
    {
      id: "VEN-105",
      name: "Ganesh Plumbing",
      materialType: "Plumbing",
      phone: "+91 98842 55120",
      address: "Ambattur Industrial Estate, Chennai",
      gst: "33AAJFG9120K1Z6",
      status: "Active",
    },
    ]),
  );
  readonly supervisors = signal<Supervisor[]>(
    this.readState<Supervisor[]>("supervisors", [
    {
      id: "SUP-101",
      name: "R. Karthik",
      phone: "+91 98400 11880",
      role: "Senior Site Supervisor",
      assignedProject: "Green Nest Villas",
      assignedSite: "Area 1 / Area 2 / Area 3",
      cashLimit: 50000,
      activeAdvances: 25000,
      approvalAuthority: "Material, Labour, Expense",
      status: "Active",
    },
    {
      id: "SUP-102",
      name: "S. Prabhu",
      phone: "+91 97911 40590",
      role: "Site Supervisor",
      assignedProject: "Kaveri Flats Renovation",
      assignedSite: "Ground Floor / First Floor",
      cashLimit: 35000,
      activeAdvances: 10000,
      approvalAuthority: "Labour, Expense",
      status: "Active",
    },
    {
      id: "SUP-103",
      name: "M. Saravanan",
      phone: "+91 98840 77012",
      role: "Finishing Supervisor",
      assignedProject: "Lakshmi Nagar Duplex",
      assignedSite: "Block A / Block B",
      cashLimit: 30000,
      activeAdvances: 0,
      approvalAuthority: "Attendance, Site Expense",
      status: "Active",
    },
    ]),
  );
  readonly subcontractors = signal<Subcontractor[]>(
    this.readState<Subcontractor[]>("subcontractors", [
    {
      id: "SUB-201",
      projectId: "AB-1024",
      site: "Area 1",
      name: "Selvam Civil Works",
      workPackage: "Block masonry and plastering",
      contractValue: 780000,
      advancePaid: 125000,
      startDate: "2026-05-08",
      dueDate: "2026-07-15",
      supervisor: "R. Karthik",
      approvalStatus: "Approved",
      paymentStatus: "Part Paid",
    },
    {
      id: "SUB-202",
      projectId: "AB-1024",
      site: "Area 2",
      name: "Ganesh Plumbing",
      workPackage: "Plumbing rough-in and testing",
      contractValue: 340000,
      advancePaid: 50000,
      startDate: "2026-05-22",
      dueDate: "2026-07-02",
      supervisor: "R. Karthik",
      approvalStatus: "Pending",
      paymentStatus: "Part Paid",
    },
    {
      id: "SUB-203",
      projectId: "AB-1031",
      site: "First Floor",
      name: "Sri Balaji Electricals",
      workPackage: "Electrical conduit and wiring",
      contractValue: 465000,
      advancePaid: 90000,
      startDate: "2026-04-25",
      dueDate: "2026-06-30",
      supervisor: "S. Prabhu",
      approvalStatus: "Approved",
      paymentStatus: "Part Paid",
    },
    ]),
  );

  readonly siteEntities = signal<Site[]>(
    this.readState<Site[]>("sites", []),
  );

  readonly reports = signal([
    "Payment Collection Report",
    "Expense Report",
    "Supervisor Ledger",
    "Attendance Report",
    "Wage Report",
    "Labour Ledger",
    "Purchase Report",
    "Consumption Report",
    "Inventory Report",
    "Subcontractor Ledger",
    "Project Summary",
    "Site Summary",
  ]);

  readonly users = signal<AppUser[]>(this.readState<AppUser[]>("appUsers", []));

  readonly activeClients = computed(() => this.clients().filter((client) => client.status === "Active").length);
  readonly customTableFields = signal<Record<SharedModuleKey, SharedTableField[]>>(
    this.readState<Record<SharedModuleKey, SharedTableField[]>>("customTableFields", this.emptySharedFieldMap()),
  );
  readonly customTableRows = signal<Record<SharedModuleKey, SharedTableRow[]>>(
    this.readState<Record<SharedModuleKey, SharedTableRow[]>>("customTableRows", this.emptySharedRowMap()),
  );
  readonly tableCellEdits = signal<Record<string, SharedTableRow>>(this.readState<Record<string, SharedTableRow>>("tableCellEdits", {}));
  readonly hiddenTableRows = signal<string[]>(this.readState<string[]>("hiddenTableRows", []));
  readonly hiddenTableFields = signal<Record<SharedModuleKey, string[]>>(
    this.readState<Record<SharedModuleKey, string[]>>("hiddenTableFields", this.emptyHiddenFieldMap()),
  );
  readonly expenseOpeningBalances = signal<Record<string, number>>(this.readState<Record<string, number>>("expenseOpeningBalances", {}));
  readonly projectActivity = signal<Record<string, number>>(this.readState<Record<string, number>>("projectActivity", {}));
  readonly settings = signal<ErpSettings>(
    this.normalizeSettings(this.readState<Partial<ErpSettings>>("settings", this.defaultSettings())),
  );

  readonly companyProfile = signal<CompanyProfile>(
    this.readState<CompanyProfile>("companyProfile", {
      name: "Annai Golden Builders",
      address: "",
      state: "Tamil Nadu",
      gstin: "",
    }),
  );

  readonly quotations = signal<Quotation[]>(this.readState<Quotation[]>("quotations", []));

  constructor() {
    effect(() => this.writeState("clients", this.clients()));
    effect(() => this.writeState("projects", this.projects()));
    effect(() => this.writeState("materials", this.materials()));
    effect(() => this.writeState("labour", this.labour()));
    effect(() => this.writeState("expenses", this.expenses()));
    effect(() => this.writeState("payments", this.payments()));
    effect(() => this.writeState("vendors", this.vendors()));
    effect(() => this.writeState("supervisors", this.supervisors()));
    effect(() => this.writeState("subcontractors", this.subcontractors()));
    effect(() => this.writeState("sites", this.siteEntities()));
    effect(() => this.writeState("customTableFields", this.customTableFields()));
    effect(() => this.writeState("customTableRows", this.customTableRows()));
    effect(() => this.writeState("tableCellEdits", this.tableCellEdits()));
    effect(() => this.writeState("hiddenTableRows", this.hiddenTableRows()));
    effect(() => this.writeState("hiddenTableFields", this.hiddenTableFields()));
    effect(() => this.writeState("expenseOpeningBalances", this.expenseOpeningBalances()));
    effect(() => this.writeState("projectActivity", this.projectActivity()));
    effect(() => this.writeState("settings", this.settings()));
    effect(() => this.writeState("appUsers", this.users()));
    effect(() => this.writeState("companyProfile", this.companyProfile()));
    effect(() => this.writeState("quotations", this.quotations()));
    effect(() => {
      const rows = this.materials();
      if (rows && rows.length) {
        this.materialsService.materials.set(rows);
      }
    });
  }

  addUser(user: Omit<AppUser, "id" | "createdAt"> & { id?: string; createdAt?: string }): AppUser {
    const numericIds = this.users()
      .map((u) => Number(u.id.replace(/\D/g, "")))
      .filter((n) => Number.isFinite(n));
    const nextId = `U-${Math.max(1000, ...numericIds) + 1}`;
    const newUser: AppUser = {
      id: user.id || nextId,
      name: user.name,
      email: user.email,
      phone: user.phone,
      role: user.role,
      status: user.status || "active",
      lastLoginAt: user.lastLoginAt,
      createdAt: user.createdAt || new Date().toISOString(),
      projectIds: user.projectIds || [],
      source: user.source || "admin",
    };
    this.users.update((list) => [newUser, ...list]);
    return newUser;
  }

  updateUser(userId: string, patch: Partial<AppUser>) {
    this.users.update((list) => list.map((u) => (u.id === userId ? { ...u, ...patch } : u)));
  }

  deleteUser(userId: string) {
    this.users.update((list) => list.filter((u) => u.id !== userId));
  }

  private ensureLargeDemoDataset() {
    const seedKey = "demoDatasetSeededV3";
    if (this.readState<boolean>(seedKey, false)) return;

    const demoClients: Client[] = [
      {
        id: "CL-1010",
        initials: "UB",
        name: "Unibuilders",
        mobile: "+91 99401 77880",
        address: "No. 18, Industrial Estate Road, Ambattur, Chennai",
        status: "Active",
        projectIds: [],
        supervisor: "R. Karthik",
      },
    ];

    this.clients.update((rows) => {
      const existingIds = new Set(rows.map((row) => row.id));
      return [...demoClients.filter((client) => !existingIds.has(client.id)), ...rows];
    });

    const projectNamePool = ["Foundation Block", "Tower Extension", "Interior Fit-Out"];
    const sitePool = [
      ["North Wing", "South Wing", "Stock Yard"],
      ["Level 1", "Level 2", "Terrace"],
      ["Main Site", "Finishing", "MEP"],
    ];
    const supervisors = ["R. Karthik", "S. Prabhu", "M. Saravanan"];
    const allClients = this.clients();
    const nextProjects = [...this.projects()];
    const projectsByClient = new Map<string, string[]>();

    allClients.forEach((client, clientIndex) => {
      const validIds = client.projectIds.filter((projectId) => nextProjects.some((project) => project.id === projectId && project.client === client.name));
      const createdIds = [...validIds];

      for (let slot = createdIds.length; slot < 3; slot += 1) {
        const projectId = `AB-${2100 + clientIndex * 10 + slot + 1}`;
        if (nextProjects.some((project) => project.id === projectId)) {
          createdIds.push(projectId);
          continue;
        }

        const totalValue = 5200000 + clientIndex * 475000 + slot * 625000;
        const receivedAmount = 1350000 + clientIndex * 140000 + slot * 225000;
        const sites = sitePool[slot % sitePool.length];
        nextProjects.unshift({
          id: projectId,
          name: `${client.name} ${projectNamePool[slot % projectNamePool.length]}`,
          client: client.name,
          mobile: client.mobile,
          address: client.address,
          supervisor: supervisors[(clientIndex + slot) % supervisors.length],
          sites,
          status: slot === 2 && clientIndex % 3 === 0 ? "On Hold" : "Active",
          startDate: `2026-0${4 + (slot % 3)}-${String(10 + ((clientIndex + slot) % 17)).padStart(2, "0")}`,
          totalValue,
          advanceAmount: Math.round(totalValue * 0.14),
          receivedAmount,
          materialSpend: 620000 + clientIndex * 55000 + slot * 70000,
          labourPayable: 185000 + clientIndex * 18000 + slot * 23000,
          expenseBalance: 18000 + clientIndex * 1800 + slot * 2500,
          completion: Math.min(82, 24 + clientIndex * 5 + slot * 8),
        });
        createdIds.push(projectId);
        this.setExpenseOpeningBalance(projectId, sites[0] ?? "Main Site", 20000 + clientIndex * 1500 + slot * 2500);
      }

      projectsByClient.set(client.id, [...new Set(createdIds)]);
    });

    this.projects.set(nextProjects);
    this.clients.update((rows) =>
      rows.map((client) => {
        const projectIds = projectsByClient.get(client.id);
        return projectIds ? { ...client, projectIds } : client;
      }),
    );

    const seededProjects = this.projects();

    const labourParties = ["Velu Mason Party", "Babu Labour Team", "Ravi Electrical Crew", "Ganesh Plumbing", "Selvam Civil Works"];
    const labourTypes = ["Mason", "Helper", "Electrician", "Plumber", "Civil"];
    if (!this.labour().some((row) => row.id.startsWith("DEMO-LAB-"))) {
      this.labour.update((rows) => [
        ...Array.from({ length: 50 }, (_, index): LabourRow => {
          const project = seededProjects[index % seededProjects.length];
          const primary = labourTypes[index % labourTypes.length];
          const helpers = 1 + (index % 4);
          const primaryCount = 2 + (index % 6);
          return {
            id: `DEMO-LAB-${String(index + 1).padStart(3, "0")}`,
            projectId: project.id,
            site: project.sites[(index + 1) % project.sites.length],
            party: labourParties[index % labourParties.length],
            category: primary,
            dailyWage: 850 + (index % 6) * 75,
            presentDays: 1,
            absentDays: index % 9 === 0 ? 1 : 0,
            presentCount: primaryCount + helpers,
            overtime: index % 4,
            lateFine: index % 6 === 0 ? 100 : 0,
            shift: String(1 + (index % 2)),
            notes: `${primary} - ${primaryCount}, Helper - ${helpers}`,
            paymentMode: index % 3 === 0 ? "Cash" : "NEFT",
            status: index % 4 === 0 ? "Pending" : "Approved",
          };
        }),
        ...rows,
      ]);
    }

    this.writeState(seedKey, true);
  }

  addClient(input: { name: string; mobile: string; address: string; supervisor: string; status?: ClientStatus }): Client {
    const nextNumber =
      Math.max(
        1000,
        ...this.clients()
          .map((client) => Number(client.id.replace(/\D/g, "")))
          .filter((value) => Number.isFinite(value)),
      ) + 1;
    const initials = input.name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((word) => word[0]?.toUpperCase() ?? "")
      .join("");
    const client: Client = {
      id: `CL-${nextNumber}`,
      initials: initials || "AG",
      name: input.name,
      mobile: input.mobile,
      address: input.address,
      status: input.status ?? "Active",
      projectIds: [],
      supervisor: input.supervisor,
    };

    this.clients.update((clients) => [client, ...clients]);
    this.writeState("clients", this.clients());
    return client;
  }

  updateClient(clientId: string, patch: Partial<Omit<Client, "id" | "projectIds">>) {
    let updatedClient: Client | undefined;

    this.clients.update((clients) =>
      clients.map((client) => {
        if (client.id !== clientId) return client;
        updatedClient = {
          ...client,
          ...patch,
          initials: patch.name ? this.initialsFor(patch.name) : client.initials,
        };
        return updatedClient;
      }),
    );

    if (!updatedClient) return;

    const syncedClient = updatedClient;
    this.projects.update((projectRows) =>
      projectRows.map((project) =>
        syncedClient.projectIds.includes(project.id)
          ? {
              ...project,
              client: syncedClient.name,
              mobile: syncedClient.mobile,
              address: syncedClient.address,
              supervisor: syncedClient.supervisor,
            }
          : project,
      ),
    );
    this.writeState("clients", this.clients());
  }

  deleteClient(clientId: string) {
    const projectIds = this.clients().find((client) => client.id === clientId)?.projectIds ?? [];
    this.clients.update((clients) => clients.filter((client) => client.id !== clientId));
    if (!projectIds.length) return;
    const projectIdSet = new Set(projectIds);
    this.projects.update((rows) => rows.filter((row) => !projectIdSet.has(row.id)));
    this.materials.update((rows) => rows.filter((row) => !projectIdSet.has(row.projectId)));
    this.labour.update((rows) => rows.filter((row) => !projectIdSet.has(row.projectId)));
    this.expenses.update((rows) => rows.filter((row) => !projectIdSet.has(row.projectId)));
    this.payments.update((rows) => rows.filter((row) => !projectIdSet.has(row.projectId)));
    this.subcontractors.update((rows) => rows.filter((row) => !projectIdSet.has(row.projectId)));
    this.writeState("clients", this.clients());
    this.writeState("projects", this.projects());
  }

  addVendor(input: { name: string; materialType: string; phone: string; address: string; gst: string; status?: VendorStatus }): Vendor {
    const nextNumber =
      Math.max(
        100,
        ...this.vendors()
          .map((v) => Number(v.id.replace(/\D/g, "")))
          .filter((value) => Number.isFinite(value)),
      ) + 1;
    const vendor: Vendor = {
      id: `VEN-${nextNumber}`,
      name: input.name,
      materialType: input.materialType,
      phone: input.phone,
      address: input.address,
      gst: input.gst,
      status: input.status ?? "Active",
    };
    this.vendors.update((vendors) => [vendor, ...vendors]);
    this.writeState("vendors", this.vendors());
    return vendor;
  }

  updateVendor(vendorId: string, patch: Partial<Omit<Vendor, "id">>) {
    this.vendors.update((vendors) =>
      vendors.map((v) => (v.id !== vendorId ? v : { ...v, ...patch })),
    );
    this.writeState("vendors", this.vendors());
  }

  setVendorStatus(vendorId: string, status: VendorStatus) {
    this.updateVendor(vendorId, { status });
  }

  vendorByName(name: string): Vendor | undefined {
    return this.vendors().find((v) => v.name === name);
  }

  deleteVendor(vendorId: string) {
    this.vendors.update((vendors) => vendors.filter((v) => v.id !== vendorId));
    this.writeState("vendors", this.vendors());
  }

  addMaterial(input: Omit<MaterialRow, "id">): MaterialRow {
    const material: MaterialRow = {
      id: `MAT-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      projectId: input.projectId || "",
      site: input.site || "",
      name: input.name || "",
      unit: input.unit || "",
      requested: input.requested ?? 0,
      approved: input.approved ?? 0,
      purchased: input.purchased ?? 0,
      consumed: input.consumed ?? 0,
      quantity: input.quantity ?? 0,
      vendor: input.vendor || "",
      poNumber: input.poNumber || "",
      status: input.status || "Pending",
      requestDate: input.requestDate,
      purchasedDate: input.purchasedDate,
      issuedAmount: input.issuedAmount,
      givenAmount: input.givenAmount,
      paymentType: input.paymentType,
      deliveredOn: input.deliveredOn,
    };
    this.materials.update((materials) => [material, ...materials]);
    this.writeState("materials", this.materials());
    return material;
  }

  updateMaterial(materialId: string, patch: Partial<MaterialRow>) {
    this.materials.update((materials) =>
      materials.map((m) => (m.id !== materialId ? m : { ...m, ...patch })),
    );
    this.writeState("materials", this.materials());
  }

  deleteMaterial(materialId: string) {
    this.materials.update((materials) => materials.filter((m) => m.id !== materialId));
    this.writeState("materials", this.materials());
  }

  createDefaultProject(client: Client): Project {
    return this.addProject(client, {
      name: `${client.name} Project`,
      sites: ["Main Site"],
      startDate: new Date().toISOString().slice(0, 10),
      supervisor: client.supervisor,
      status: "Active",
      totalValue: 0,
      advanceAmount: 0,
    });
  }

  firstProjectForClient(client: Client | undefined): Project | undefined {
    return this.projectsForClient(client)[0];
  }

  addProject(
    client: Client,
    input: {
      name: string;
      sites: string[];
      startDate: string;
      supervisor: string;
      status?: ProjectStatus;
      totalValue: number;
      advanceAmount: number;
      receivedAmount?: number;
      openingBalance?: number;
    },
  ): Project {
    const numericIds = this.projects()
      .map((project) => Number(project.id.replace(/\D/g, "")))
      .filter((value) => Number.isFinite(value));
    const nextId = Math.max(...numericIds, 1031) + 1;
    const project: Project = {
      id: `AB-${nextId}`,
      name: input.name,
      client: client.name,
      mobile: client.mobile,
      address: client.address,
      supervisor: input.supervisor,
      sites: input.sites.length ? input.sites : ["Main Site"],
      status: input.status ?? "Active",
      startDate: input.startDate,
      totalValue: input.totalValue,
      advanceAmount: input.advanceAmount,
      receivedAmount: input.receivedAmount ?? input.advanceAmount,
      materialSpend: 0,
      labourPayable: 0,
      expenseBalance: input.openingBalance ?? 0,
      completion: 0,
    };

    this.projects.update((projects) => [project, ...projects]);
    if (project.expenseBalance) this.setExpenseOpeningBalance(project.id, project.sites[0] ?? "Main Site", project.expenseBalance);
    this.clients.update((clients) =>
      clients.map((existingClient) =>
        existingClient.id === client.id ? { ...existingClient, projectIds: [project.id, ...existingClient.projectIds] } : existingClient,
      ),
    );
    this.touchProject(project.id);
    return project;
  }

  addSiteToProject(projectId: string, siteName: string): Project | undefined {
    const cleanName = siteName.trim();
    if (!cleanName) return undefined;
    let updatedProject: Project | undefined;

    this.projects.update((projectRows) =>
      projectRows.map((project) => {
        if (project.id !== projectId) return project;
        const alreadyExists = project.sites.some((site) => site.toLowerCase() === cleanName.toLowerCase());
        if (alreadyExists) {
          updatedProject = project;
          return project;
        }
        updatedProject = { ...project, sites: [...project.sites, cleanName] };
        return updatedProject;
      }),
    );

    if (updatedProject) this.touchProject(projectId);
    return updatedProject;
  }

  removeSiteFromProject(projectId: string, siteName: string): Project | undefined {
    const cleanName = siteName.trim();
    if (!cleanName) return undefined;
    let updatedProject: Project | undefined;

    this.projects.update((projectRows) =>
      projectRows.map((project) => {
        if (project.id !== projectId || project.sites.length <= 1) return project;
        const nextSites = project.sites.filter((site) => site.toLowerCase() !== cleanName.toLowerCase());
        if (nextSites.length === project.sites.length || !nextSites.length) return project;
        updatedProject = { ...project, sites: nextSites };
        return updatedProject;
      }),
    );

    if (updatedProject) {
      const key = this.expenseOpeningBalanceKey(projectId, cleanName);
      this.expenseOpeningBalances.update((balances) => {
        const { [key]: _removed, ...nextBalances } = balances;
        return nextBalances;
      });
    }

    if (updatedProject) this.touchProject(projectId);
    return updatedProject;
  }

  expenseOpeningBalanceFor(projectId: string, siteName: string): number | undefined {
    const key = this.expenseOpeningBalanceKey(projectId, siteName);
    return this.expenseOpeningBalances()[key];
  }

  setExpenseOpeningBalance(projectId: string, siteName: string, amount: number) {
    const key = this.expenseOpeningBalanceKey(projectId, siteName);
    this.expenseOpeningBalances.update((balances) => ({ ...balances, [key]: amount }));
    this.touchProject(projectId);
  }

  setExpenses(rows: ExpenseRow[]) {
    this.expenses.set(rows);
    this.writeState("expenses", rows);
  }

  updateSettings(patch: Partial<ErpSettings>) {
    this.settings.update((settings) => ({ ...settings, ...patch }));
  }

  roleOptionsFor(role: ManagedRole): RoleOption[] {
    return this.settings().roleOptions.filter((option) => option.role === role);
  }

  addRoleOption(role: ManagedRole, label: string): RoleOption | undefined {
    const cleanLabel = label.trim();
    if (!cleanLabel) return undefined;
    const existing = this.roleOptionsFor(role).some((option) => option.label.toLowerCase() === cleanLabel.toLowerCase());
    if (existing) return undefined;
    const option: RoleOption = {
      id: `role-option:${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      role,
      label: cleanLabel,
    };
    this.settings.update((settings) => ({ ...settings, roleOptions: [...settings.roleOptions, option] }));
    return option;
  }

  deleteRoleOption(optionId: string) {
    this.settings.update((settings) => ({ ...settings, roleOptions: settings.roleOptions.filter((option) => option.id !== optionId) }));
  }

  rolePermission(role: ManagedRole, fieldId: string): RolePermissionLevel {
    return this.settings().rolePermissions[role]?.[fieldId] ?? this.defaultRolePermission(role, fieldId);
  }

  setRolePermission(role: ManagedRole, fieldId: string, level: RolePermissionLevel) {
    this.settings.update((settings) => ({
      ...settings,
      rolePermissions: {
        ...settings.rolePermissions,
        [role]: {
          ...(settings.rolePermissions[role] ?? {}),
          [fieldId]: level,
        },
      },
    }));
  }

  updateProject(
    projectId: string,
    patch: Partial<Pick<Project, "name" | "sites" | "startDate" | "supervisor" | "status" | "totalValue" | "advanceAmount" | "receivedAmount" | "expenseBalance">>,
  ): Project | undefined {
    let updatedProject: Project | undefined;

    this.projects.update((projectRows) =>
      projectRows.map((project) => {
        if (project.id !== projectId) return project;
        const receivedDelta =
          patch.advanceAmount !== undefined && project.receivedAmount === project.advanceAmount
            ? patch.advanceAmount - project.advanceAmount
            : 0;
        updatedProject = {
          ...project,
          ...patch,
          sites: patch.sites?.length ? patch.sites : project.sites,
          receivedAmount: patch.receivedAmount !== undefined ? Math.max(0, patch.receivedAmount) : project.receivedAmount + receivedDelta,
        };
        return updatedProject;
      }),
    );

    if (updatedProject) this.touchProject(projectId);
    return updatedProject;
  }

  deleteProject(projectId: string) {
    this.projects.update((projectRows) => projectRows.filter((project) => project.id !== projectId));
    this.projectActivity.update((activity) => {
      const { [projectId]: _removed, ...nextActivity } = activity;
      return nextActivity;
    });
    this.clients.update((clientRows) =>
      clientRows.map((client) => ({
        ...client,
        projectIds: client.projectIds.filter((id) => id !== projectId),
      })),
    );
  }

  clientById(clientId: string | null): Client | undefined {
    return this.clients().find((client) => client.id === clientId);
  }

  projectById(projectId: string | null): Project | undefined {
    return this.projects().find((project) => project.id === projectId);
  }

  projectsForClient(client: Client | undefined): Project[] {
    if (!client) return [];
    return this.sortProjectsByLastWorked(this.projects().filter((project) => client.projectIds.includes(project.id)));
  }

  touchProject(projectId: string) {
    if (!projectId) return;
    this.projectActivity.update((activity) => ({ ...activity, [projectId]: Date.now() }));
  }

  projectLastWorkedAt(projectId: string): number {
    return this.projectActivity()[projectId] ?? 0;
  }

  projectLastWorkedLabel(projectId: string): string {
    const timestamp = this.projectLastWorkedAt(projectId);
    if (!timestamp) return "Not worked yet";
    const minutes = Math.max(0, Math.floor((Date.now() - timestamp) / 60000));
    if (minutes < 1) return "Just now";
    if (minutes === 1) return "1 min ago";
    if (minutes < 60) return `${minutes} mins ago`;
    const hours = Math.floor(minutes / 60);
    if (hours === 1) return "1 hr ago";
    if (hours < 24) return `${hours} hrs ago`;
    const days = Math.floor(hours / 24);
    return days === 1 ? "1 day ago" : `${days} days ago`;
  }

  sortProjectsByLastWorked(projectRows: Project[]): Project[] {
    return [...projectRows].sort((first, second) => {
      const activityDelta = this.projectLastWorkedAt(second.id) - this.projectLastWorkedAt(first.id);
      if (activityDelta) return activityDelta;
      return second.startDate.localeCompare(first.startDate);
    });
  }

  materialsForProject(projectId: string): MaterialRow[] {
    return this.materials().filter((row) => row.projectId === projectId);
  }

  labourForProject(projectId: string): LabourRow[] {
    return this.labour().filter((row) => row.projectId === projectId);
  }

  expensesForProject(projectId: string): ExpenseRow[] {
    return this.expenses().filter((row) => row.projectId === projectId);
  }

  paymentsForProject(projectId: string): PaymentRow[] {
    return this.payments().filter((row) => row.projectId === projectId);
  }

  projectReceivedAmount(projectOrId: Project | string | undefined): number {
    const project = typeof projectOrId === "string" ? this.projectById(projectOrId) : projectOrId;
    if (!project) return 0;
    return this.paymentLedgerTotalForProject(project);
  }

  projectPendingAmount(projectOrId: Project | string | undefined): number {
    const project = typeof projectOrId === "string" ? this.projectById(projectOrId) : projectOrId;
    if (!project) return 0;
    return Math.max(0, project.totalValue - this.projectReceivedAmount(project));
  }

  subcontractorsForProject(projectId: string): Subcontractor[] {
    return this.subcontractors().filter((row) => row.projectId === projectId);
  }

  customFieldsFor(module: SharedModuleKey): SharedTableField[] {
    return this.customTableFields()[module] ?? [];
  }

  hiddenFieldsFor(module: SharedModuleKey): string[] {
    return this.hiddenTableFields()[module] ?? [];
  }

  hideTableField(module: SharedModuleKey, key: string) {
    if (!key) return;
    this.hiddenTableFields.update((fields) => {
      const hidden = fields[module] ?? [];
      return hidden.includes(key) ? fields : { ...fields, [module]: [...hidden, key] };
    });
  }

  resetTableFields(module: SharedModuleKey) {
    this.hiddenTableFields.update((fields) => ({ ...fields, [module]: [] }));
  }

  addCustomField(module: SharedModuleKey, label: string, existingColumns: SharedTableField[] = []): SharedTableField {
    const field: SharedTableField = {
      key: this.fieldKey(label, [...existingColumns, ...this.customFieldsFor(module)]),
      label,
    };

    this.customTableFields.update((fields) => ({
      ...fields,
      [module]: [...(fields[module] ?? []), field],
    }));
    return field;
  }

  addCustomFieldAfter(module: SharedModuleKey, label: string, afterKey: string | null, existingColumns: SharedTableField[] = []): SharedTableField {
    const field = this.addCustomField(module, label, existingColumns);
    if (!afterKey) return field;
    this.customTableFields.update((fields) => ({
      ...fields,
      [module]: (fields[module] ?? []).map((customField) => (customField.key === field.key ? { ...customField, afterKey } : customField)),
    }));
    return { ...field, afterKey };
  }

  /**
   * Persist a custom field to the backend (MongoDB) so that supervisors
   * will see it in their mobile form. If the backend call fails the local
   * cache is still updated so the admin can see the column in the table.
   */
  async persistCustomField(
    module: SharedModuleKey,
    label: string,
    siteId: string | null,
    fieldType: "text" | "number" | "date" | "boolean" = "text",
    askSupervisor = true
  ): Promise<SharedTableField | null> {
    if (!siteId) {
      return null;
    }
    const entityType = this.entityTypeForModule(module);
    const key = this.fieldKey(label, this.customFieldsFor(module));
    try {
      const result = await new Promise<{ field: ApiCustomField }>((resolve, reject) => {
        this.customFieldsService
          .create({
            entityType,
            entityId: siteId,
            key,
            label,
            value: null,
            fieldType,
            order: 0,
            askSupervisor,
          })
          .subscribe({ next: resolve, error: reject });
      });
      return { key: result.field.key, label: result.field.label };
    } catch (err) {
      console.warn(`[ErpData] failed to persist custom field to backend`, err);
      return null;
    }
  }

  private entityTypeForModule(module: SharedModuleKey): "clients" | "projects" | "materials" | "labour" | "expenses" | "payments" | "vendors" | "subcontractors" {
    switch (module) {
      case "clients": return "clients";
      case "materials": return "materials";
      case "labour": return "labour";
      case "expenses":
      case "generalExpenses": return "expenses";
      case "payments": return "payments";
      case "vendors": return "vendors";
      case "subcontractors": return "subcontractors";
      default: return "materials";
    }
  }

  sites(): { id: string; name: string }[] {
    const seen = new Set<string>();
    const list: { id: string; name: string }[] = [];
    const push = (id: unknown, name: unknown) => {
      if (!id) return;
      const key = String(id);
      if (seen.has(key)) return;
      seen.add(key);
      list.push({ id: key, name: String(name || key) });
    };
    for (const project of this.projects()) {
      for (const site of project.sites ?? []) push(site, site);
    }
    for (const row of this.materials()) push(row["site"], row["site"]);
    for (const row of this.labour()) push(row["site"], row["site"]);
    for (const row of this.expenses()) push(row["site"], row["site"]);
    
    // Also include sites from backend (siteEntities signal)
    for (const site of this.siteEntities()) {
      push(site.id, site.name);
    }
    
    return list;
  }

  getSiteEntities(): Site[] {
    return this.siteEntities().map((site) => ({
      ...site,
      status: site.status || "Active",
      projectId: site.projectId || "",
    }));
  }

  composeTableColumns(base: SharedTableField[], custom: SharedTableField[]): SharedTableField[] {
    const output = [...base];
    const pending = [...custom];

    let changed = true;
    while (changed) {
      changed = false;
      for (let index = pending.length - 1; index >= 0; index -= 1) {
        const field = pending[index];
        if (!field.afterKey) continue;
        const insertIndex = output.findIndex((column) => column.key === field.afterKey);
        if (insertIndex < 0) continue;
        const siblingCount = output.slice(insertIndex + 1).findIndex((column) => column.afterKey !== field.afterKey);
        const offset = siblingCount < 0 ? output.length - insertIndex - 1 : siblingCount;
        output.splice(insertIndex + 1 + offset, 0, field);
        pending.splice(index, 1);
        changed = true;
      }
    }

    return [...output, ...pending];
  }

  tableRowsFor(module: SharedModuleKey, baseRows: SharedTableRow[] = [], predicate?: (row: SharedTableRow) => boolean): SharedTableRow[] {
    const edits = this.tableCellEdits();
    const hidden = new Set(this.hiddenTableRows());
    return [...(this.customTableRows()[module] ?? []), ...baseRows]
      .filter((row) => !hidden.has(String(row["__rowId"] || "")))
      .map((row) => {
        const rowId = String(row["__rowId"] || "");
        return rowId && edits[rowId] ? { ...row, ...edits[rowId] } : row;
      })
      .filter((row) => (predicate ? predicate(row) : true));
  }

  addCustomRow(module: SharedModuleKey, row: SharedTableRow): SharedTableRow {
    const nextRow: SharedTableRow = {
      ...row,
      __rowId: `custom:${module}:${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    };
    this.customTableRows.update((rows) => ({
      ...rows,
      [module]: [nextRow, ...(rows[module] ?? [])],
    }));
    const projectId = this.projectIdFromSharedRow(nextRow);
    if (projectId) this.touchProject(projectId);
    return nextRow;
  }

  updateSharedRowCell(rowId: string, key: string, value: string | number) {
    if (!rowId) return;
    const projectId = key === "projectId" ? String(value || "") : this.projectIdFromSharedRowId(rowId);

    this.customTableRows.update((rows) => {
      let changed = false;
      const nextRows = Object.fromEntries(
        Object.entries(rows).map(([module, moduleRows]) => [
          module,
          moduleRows.map((row) => {
            if (String(row["__rowId"] || "") !== rowId) return row;
            changed = true;
            return { ...row, [key]: value };
          }),
        ]),
      ) as Record<SharedModuleKey, SharedTableRow[]>;
      return changed ? nextRows : rows;
    });

    this.tableCellEdits.update((edits) => ({
      ...edits,
      [rowId]: { ...(edits[rowId] ?? {}), [key]: value },
    }));
    if (projectId) this.touchProject(projectId);
  }

  deleteSharedRow(rowId: string) {
    if (!rowId) return;
    const projectId = this.projectIdFromSharedRowId(rowId);
    this.customTableRows.update((rows) => {
      const nextRows = Object.fromEntries(
        Object.entries(rows).map(([module, moduleRows]) => [module, moduleRows.filter((row) => String(row["__rowId"] || "") !== rowId)]),
      ) as Record<SharedModuleKey, SharedTableRow[]>;
      return nextRows;
    });
    this.hiddenTableRows.update((rowIds) => (rowIds.includes(rowId) ? rowIds : [...rowIds, rowId]));
    if (projectId) this.touchProject(projectId);
  }

  private projectIdFromSharedRow(row: SharedTableRow | undefined): string {
    return String(row?.["projectId"] || row?.["__projectId"] || "").trim();
  }

  private projectIdFromSharedRowId(rowId: string): string {
    const customRows = Object.values(this.customTableRows()).flat();
    const baseRows: SharedTableRow[] = [
      ...this.materials(),
      ...this.labour(),
      ...this.expenses(),
      ...this.payments(),
      ...this.subcontractors(),
    ];
    const match = [...customRows, ...baseRows].find((row) => String(row["__rowId"] || "") === rowId);
    const edits = this.tableCellEdits()[rowId] ?? {};
    return String(edits["projectId"] || edits["__projectId"] || this.projectIdFromSharedRow(match)).trim();
  }

  clientSummary(client: Client) {
    const clientProjects = this.projectsForClient(client);
    const totalValue = clientProjects.reduce((sum, project) => sum + project.totalValue, 0);
    const received = clientProjects.reduce((sum, project) => sum + this.projectReceivedAmount(project), 0);
    const pending = clientProjects.reduce((sum, project) => sum + this.projectPendingAmount(project), 0);
    const sites = clientProjects.reduce((sum, project) => sum + project.sites.length, 0);
    const materialCost = clientProjects.reduce((sum, project) => sum + project.materialSpend, 0);
    const labourCost = clientProjects.reduce((sum, project) => sum + project.labourPayable, 0);
    const siteExpense = clientProjects.reduce((sum, project) => sum + project.expenseBalance, 0);

    return {
      projectCount: clientProjects.length,
      activeSites: sites,
      totalValue,
      received,
      pending,
      materialCost,
      labourCost,
      siteExpense,
      activeLabour: this.labour()
        .filter((row) => clientProjects.some((project) => project.id === row.projectId))
        .reduce((sum, row) => sum + row.presentCount, 0),
    };
  }

  private paymentLedgerTotalForProject(project: Project): number {
    return this.paymentLedgerRowsForProject(project).reduce((sum, row) => sum + this.paymentAmountForLedgerRow(row), 0);
  }

  private paymentLedgerRowsForProject(project: Project): SharedTableRow[] {
    const baseRows = this.payments().map((row) => ({
      __rowId: `payment:${row.id}`,
      __projectId: row.projectId,
      projectId: row.projectId,
      paymentDate: row.date,
      amount: row.amount,
      mode: row.mode,
      transactionReference: row.reference,
      receiptNumber: row.receipt,
      collectedBy: row.collectedBy,
      approvalStatus: row.status,
    }));
    return this.tableRowsFor("payments", baseRows, (row) => this.paymentRowBelongsToProject(row, project));
  }

  private paymentRowBelongsToProject(row: SharedTableRow, project: Project): boolean {
    const rowProjectId = String(row["projectId"] || row["__projectId"] || "").trim();
    if (rowProjectId) return rowProjectId === project.id;
    const rowProject = String(row["project"] || "").trim();
    return rowProject === project.id || rowProject.toLowerCase() === project.name.toLowerCase();
  }

  private paymentAmountForLedgerRow(row: SharedTableRow): number {
    const status = String(row["approvalStatus"] || row["status"] || "").trim().toLowerCase();
    if (status === "declined" || status === "rejected") return 0;
    return Math.max(0, this.moneyNumber(row["amount"]));
  }

  private moneyNumber(value: unknown): number {
    const parsed = Number(String(value ?? "").replace(/[^\d.-]/g, ""));
    return Number.isFinite(parsed) ? parsed : 0;
  }

  private defaultSettings(): ErpSettings {
    return {
      singleApprovalForSiteExpenseMaterials: false,
      roleOptions: [
        { id: "role-option:pm-site", role: "Project Manager", label: "Site approvals" },
        { id: "role-option:pm-procurement", role: "Project Manager", label: "Procurement review" },
        { id: "role-option:accountant-ledger", role: "Accountant", label: "Ledger posting" },
        { id: "role-option:accountant-payments", role: "Accountant", label: "Payment verification" },
        { id: "role-option:supervisor-field", role: "Supervisor", label: "Field entry" },
        { id: "role-option:supervisor-attendance", role: "Supervisor", label: "Attendance capture" },
      ],
      rolePermissions: {
        "Project Manager": {},
        Accountant: {},
        Supervisor: {},
      },
    };
  }

  private normalizeSettings(settings: Partial<ErpSettings> | undefined): ErpSettings {
    const defaults = this.defaultSettings();
    const incomingPermissions = (settings?.rolePermissions ?? {}) as Partial<Record<ManagedRole, Record<string, RolePermissionLevel>>>;
    const rolePermissions = Object.fromEntries(
      managedRoleNames.map((role) => [role, { ...(defaults.rolePermissions[role] ?? {}), ...(incomingPermissions[role] ?? {}) }]),
    ) as Record<ManagedRole, Record<string, RolePermissionLevel>>;

    return {
      ...defaults,
      ...(settings ?? {}),
      roleOptions: settings?.roleOptions?.length ? settings.roleOptions : defaults.roleOptions,
      rolePermissions,
    };
  }

  private defaultRolePermission(role: ManagedRole, fieldId: string): RolePermissionLevel {
    if (fieldId.startsWith("settings.")) return "hidden";
    if (role === "Project Manager") {
      if (fieldId.startsWith("clients.")) return "read";
      if (fieldId.startsWith("payments.")) return "read";
      return "edit";
    }
    if (role === "Accountant") {
      if (fieldId.startsWith("expenses.") || fieldId.startsWith("generalExpenses.") || fieldId.startsWith("payments.") || fieldId.startsWith("reports.")) {
        return "edit";
      }
      return "read";
    }
    if (fieldId.startsWith("materials.") || fieldId.startsWith("labour.") || fieldId.startsWith("expenses.")) return "write";
    return "read";
  }

  private initialsFor(name: string): string {
    return (
      name
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((word) => word[0]?.toUpperCase() ?? "")
        .join("") || "AG"
    );
  }

  private readState<T>(key: string, fallback: T): T {
    if (typeof localStorage === "undefined") return fallback;

    try {
      const value = localStorage.getItem(this.storageKey(key));
      return value ? (JSON.parse(value) as T) : fallback;
    } catch {
      return fallback;
    }
  }

  private writeState<T>(key: string, value: T) {
    if (typeof localStorage === "undefined") return;

    try {
      localStorage.setItem(this.storageKey(key), JSON.stringify(value));
    } catch {
      // Local storage is a convenience for the static demo, so quota failures should not block the UI.
    }
  }

  private storageKey(key: string): string {
    return `agb-erp:${key}`;
  }

  private recoverTablePresentationState(): boolean {
    if (typeof localStorage === "undefined") return true;

    const recoveryKey = this.storageKey("dashboardPresentationRecoveryV1");
    if (localStorage.getItem(recoveryKey) === "complete") return true;

    try {
      localStorage.removeItem(this.storageKey("hiddenTableFields"));
      const customFieldsKey = this.storageKey("customTableFields");
      const storedFields = localStorage.getItem(customFieldsKey);
      if (storedFields) {
        const parsed = JSON.parse(storedFields) as Record<string, SharedTableField[]>;
        const sanitized = Object.fromEntries(
          Object.entries(parsed).map(([module, fields]) => [
            module,
            Array.isArray(fields)
              ? fields.filter((field) => typeof field?.label === "string" && field.label.trim() && typeof field?.key === "string" && field.key.trim())
              : [],
          ]),
        );
        localStorage.setItem(customFieldsKey, JSON.stringify(sanitized));
      }
      localStorage.setItem(recoveryKey, "complete");
    } catch {
      // The recovery only protects the static demo presentation state.
    }

    return true;
  }

  private expenseOpeningBalanceKey(projectId: string, siteName: string): string {
    return `${projectId}::${siteName.trim().toLowerCase() || "project"}`;
  }

  private emptySharedFieldMap(): Record<SharedModuleKey, SharedTableField[]> {
    return {
      materials: [],
      clients: [],
      labour: [],
      expenses: [],
      generalExpenses: [],
      payments: [],
      vendors: [],
      supervisors: [],
      subcontractors: [],
      inventory: [],
      reports: [],
      settings: [],
    };
  }

  private emptySharedRowMap(): Record<SharedModuleKey, SharedTableRow[]> {
    return {
      materials: [],
      clients: [],
      labour: [],
      expenses: [],
      generalExpenses: [],
      payments: [],
      vendors: [],
      supervisors: [],
      subcontractors: [],
      inventory: [],
      reports: [],
      settings: [],
    };
  }

  private emptyHiddenFieldMap(): Record<SharedModuleKey, string[]> {
    return {
      materials: [],
      clients: [],
      labour: [],
      expenses: [],
      generalExpenses: [],
      payments: [],
      vendors: [],
      supervisors: [],
      subcontractors: [],
      inventory: [],
      reports: [],
      settings: [],
    };
  }

  private fieldKey(label: string, existingColumns: SharedTableField[]): string {
    const base = label
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
    const candidate = base || `custom-${Date.now()}`;
    const existing = new Set(existingColumns.map((column) => column.key));
    if (!existing.has(candidate)) return candidate;
    let index = 2;
    while (existing.has(`${candidate}-${index}`)) index += 1;
    return `${candidate}-${index}`;
  }

  updateCompanyProfile(patch: Partial<CompanyProfile>) {
    this.companyProfile.update((profile) => ({ ...profile, ...patch }));
  }

  addQuotation(input: Omit<Quotation, "id" | "quotationNumber" | "createdAt" | "updatedAt">): Quotation {
    const nextNumber =
      Math.max(
        0,
        ...this.quotations()
          .map((q) => Number(q.quotationNumber.replace(/\D/g, "")))
          .filter((value) => Number.isFinite(value)),
      ) + 1;
    const quotation: Quotation = {
      id: `QUO-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      quotationNumber: `QUO-${String(nextNumber).padStart(4, "0")}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      ...input,
    };
    this.quotations.update((quotations) => [quotation, ...quotations]);

    this.api.createQuotation(quotation).subscribe({
      next: (res) => {
        if (res?.quotation?._id) {
          this.quotations.update((qs) =>
            qs.map((q) => q.id === quotation.id ? { ...q, id: res.quotation._id } : q)
          );
        }
      },
      error: (err) => console.warn("[ERP] createQuotation failed:", err?.message ?? err),
    });

    return quotation;
  }

  updateQuotation(quotationId: string, patch: Partial<Omit<Quotation, "id" | "quotationNumber" | "createdAt">>) {
    this.quotations.update((quotations) =>
      quotations.map((q) =>
        q.id !== quotationId ? q : { ...q, ...patch, updatedAt: new Date().toISOString() }
      ),
    );

    this.api.patchQuotation(quotationId, patch).subscribe({
      error: (err) => console.warn("[ERP] patchQuotation failed:", err?.message ?? err),
    });
  }

  deleteQuotation(quotationId: string) {
    this.quotations.update((quotations) => quotations.filter((q) => q.id !== quotationId));

    this.api.deleteQuotation(quotationId).subscribe({
      error: (err) => console.warn("[ERP] deleteQuotation failed:", err?.message ?? err),
    });
  }

  quotationById(quotationId: string): Quotation | undefined {
    return this.quotations().find((q) => q.id === quotationId);
  }
}
