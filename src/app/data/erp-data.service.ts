import { Injectable, computed, effect, signal } from "@angular/core";
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
} from "../../data/dashboardData";

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
};

export type Vendor = {
  id: string;
  name: string;
  materialType: string;
  phone: string;
  address: string;
  gst: string;
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
  | "reports"
  | "settings";
export type SharedFieldType = "text" | "number" | "date";
export type SharedTableField = { key: string; label: string; type?: SharedFieldType; afterKey?: string };
export type SharedTableRow = Record<string, string | number | undefined>;

@Injectable({ providedIn: "root" })
export class ErpDataService {
  private readonly recoveredTablePresentationState = this.recoverTablePresentationState();

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
  readonly expenses = signal<ExpenseRow[]>(this.readState<ExpenseRow[]>("expenses", expenses));
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
    },
    {
      id: "VEN-102",
      name: "KMS Agencies",
      materialType: "Cement",
      phone: "+91 98411 40222",
      address: "Guindy, Chennai",
      gst: "33AAKFK9902L1Z4",
    },
    {
      id: "VEN-103",
      name: "Amman Steel",
      materialType: "Steel",
      phone: "+91 99620 88910",
      address: "Ambattur, Chennai",
      gst: "33AABFA8821M1Z2",
    },
    {
      id: "VEN-104",
      name: "Thirumalai Blue Metals",
      materialType: "M-Sand",
      phone: "+91 94440 70115",
      address: "Poonamallee, Chennai",
      gst: "33AABFT4021K1Z9",
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

  constructor() {
    this.ensureMeenakshiSampleProject();
    this.ensureLargeDemoDataset();
    effect(() => this.writeState("clients", this.clients()));
    effect(() => this.writeState("projects", this.projects()));
    effect(() => this.writeState("materials", this.materials()));
    effect(() => this.writeState("labour", this.labour()));
    effect(() => this.writeState("expenses", this.expenses()));
    effect(() => this.writeState("payments", this.payments()));
    effect(() => this.writeState("vendors", this.vendors()));
    effect(() => this.writeState("supervisors", this.supervisors()));
    effect(() => this.writeState("subcontractors", this.subcontractors()));
    effect(() => this.writeState("customTableFields", this.customTableFields()));
    effect(() => this.writeState("customTableRows", this.customTableRows()));
    effect(() => this.writeState("tableCellEdits", this.tableCellEdits()));
    effect(() => this.writeState("hiddenTableRows", this.hiddenTableRows()));
    effect(() => this.writeState("hiddenTableFields", this.hiddenTableFields()));
    effect(() => this.writeState("expenseOpeningBalances", this.expenseOpeningBalances()));
  }

  private ensureMeenakshiSampleProject() {
    const sampleProjectId = "AB-1040";
    const client = this.clients().find((row) => row.name === "Meenakshi Raman");
    if (!client) return;

    if (!this.projects().some((project) => project.id === sampleProjectId)) {
      this.projects.update((projectRows) => [
        {
          id: sampleProjectId,
          name: "Meenakshi Full Scope Sample",
          client: client.name,
          mobile: client.mobile,
          address: client.address,
          supervisor: client.supervisor,
          sites: ["VVD", "Main Site", "Finishing"],
          status: "Active",
          startDate: "2026-06-08",
          totalValue: 9390000,
          advanceAmount: 1000000,
          receivedAmount: 2250000,
          materialSpend: 1425000,
          labourPayable: 386400,
          expenseBalance: 20000,
          completion: 27,
        },
        ...projectRows,
      ]);
    }

    const projectRows = this.projects();
    this.clients.update((clientRows) =>
      clientRows.map((row) => {
        if (row.id !== client.id) return row;
        const validProjectIds = row.projectIds.filter((projectId) => {
          const project = projectRows.find((projectRow) => projectRow.id === projectId);
          return !project || project.client === row.name;
        });
        return { ...row, projectIds: [...new Set([sampleProjectId, ...validProjectIds])] };
      }),
    );

    if (!this.materials().some((row) => row.projectId === sampleProjectId)) {
      this.materials.update((rows) => [
        {
          id: "MAT-900",
          projectId: sampleProjectId,
          site: "VVD",
          name: "Cement",
          unit: "Bag",
          requested: 260,
          approved: 240,
          purchased: 220,
          consumed: 136,
          vendor: "KMS Agencies",
          poNumber: "PO-2091",
          status: "Approved",
        },
        {
          id: "MAT-901",
          projectId: sampleProjectId,
          site: "Main Site",
          name: "Bricks",
          unit: "Nos",
          requested: 18000,
          approved: 15000,
          purchased: 12000,
          consumed: 8400,
          vendor: "Sri Devi Traders",
          poNumber: "PO-2092",
          status: "Pending",
        },
        {
          id: "MAT-902",
          projectId: sampleProjectId,
          site: "Finishing",
          name: "Steel Rod",
          unit: "Kg",
          requested: 3200,
          approved: 2800,
          purchased: 2400,
          consumed: 1180,
          vendor: "Amman Steel",
          poNumber: "PO-2093",
          status: "Approved",
        },
        ...rows,
      ]);
    }

    if (!this.labour().some((row) => row.projectId === sampleProjectId)) {
      this.labour.update((rows) => [
        {
          id: "LAB-900",
          projectId: sampleProjectId,
          site: "VVD",
          party: "Balu Mason Team",
          category: "Mason",
          dailyWage: 950,
          presentDays: 6,
          absentDays: 1,
          presentCount: 7,
          overtime: 3,
          lateFine: 0,
          shift: "Day",
          notes: "Mason - 4, Helper - 3",
          paymentMode: "NEFT",
          status: "Approved",
        },
        {
          id: "LAB-901",
          projectId: sampleProjectId,
          site: "Main Site",
          party: "Ravi Electrical Crew",
          category: "Electrician",
          dailyWage: 1150,
          presentDays: 5,
          absentDays: 1,
          presentCount: 4,
          overtime: 2,
          lateFine: 150,
          shift: "Day",
          notes: "Electrician - 3, Helper - 1",
          paymentMode: "Cash",
          status: "Pending",
        },
        ...rows,
      ]);
    }

    if (!this.expenses().some((row) => row.projectId === sampleProjectId)) {
      this.expenses.update((rows) => [
        {
          id: "EXP-900",
          projectId: sampleProjectId,
          site: "VVD",
          supervisor: client.supervisor,
          date: "2026-06-08",
          description: "Petrol 1 L and site measuring tape",
          type: "Site Expense",
          received: 20000,
          spent: 108,
          reference: "VVD-001",
          status: "Approved",
        },
        {
          id: "EXP-901",
          projectId: sampleProjectId,
          site: "VVD",
          supervisor: client.supervisor,
          date: "2026-06-08",
          description: "Hammer and brush set",
          type: "Site Expense",
          received: 0,
          spent: 520,
          reference: "VVD-002",
          status: "Pending",
        },
        {
          id: "EXP-902",
          projectId: sampleProjectId,
          site: "Main Site",
          supervisor: client.supervisor,
          date: "2026-06-07",
          description: "Safety gloves and site drinking water",
          type: "Site Expense",
          received: 15000,
          spent: 2400,
          reference: "MAIN-014",
          status: "Approved",
        },
        ...rows,
      ]);
    }

    if (!this.payments().some((row) => row.projectId === sampleProjectId)) {
      this.payments.update((rows) => [
        {
          id: "PAY-900",
          projectId: sampleProjectId,
          date: "2026-06-08",
          amount: 1000000,
          mode: "NEFT",
          receipt: "RCT-2201",
          reference: "UTR 99081234",
          collectedBy: "Anitha",
          status: "Approved",
        },
        ...rows,
      ]);
    }

    if (!this.subcontractors().some((row) => row.projectId === sampleProjectId)) {
      this.subcontractors.update((rows) => [
        {
          id: "SUB-900",
          projectId: sampleProjectId,
          site: "Finishing",
          name: "Sri Balaji Electricals",
          workPackage: "Conduit, wiring, DB dressing, and final testing",
          contractValue: 620000,
          advancePaid: 125000,
          startDate: "2026-06-10",
          dueDate: "2026-08-05",
          supervisor: client.supervisor,
          approvalStatus: "Approved",
          paymentStatus: "Part Paid",
        },
        ...rows,
      ]);
    }
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
    const materialNames = [
      ["Cement", "Bag", "KMS Agencies"],
      ["Bricks", "Nos", "Sri Devi Traders"],
      ["Steel Rod", "Kg", "Amman Steel"],
      ["M-Sand", "Load", "Thirumalai Blue Metals"],
      ["Blue Metal", "Load", "Thirumalai Blue Metals"],
      ["PVC Pipe", "Piece", "Ganesh Plumbing"],
      ["Electrical Wire", "Bundle", "Sri Balaji Electricals"],
      ["Paint Primer", "Tin", "Sri Devi Traders"],
    ];

    if (!this.materials().some((row) => row.id.startsWith("DEMO-MAT-"))) {
      this.materials.update((rows) => [
        ...Array.from({ length: 50 }, (_, index): MaterialRow => {
          const project = seededProjects[index % seededProjects.length];
          const item = materialNames[index % materialNames.length];
          const requested = 80 + index * 13;
          const approved = Math.max(20, requested - (index % 7) * 5);
          const purchased = Math.max(0, approved - (index % 5) * 3);
          const consumed = Math.max(0, purchased - (index % 6) * 2);
          return {
            id: `DEMO-MAT-${String(index + 1).padStart(3, "0")}`,
            projectId: project.id,
            site: project.sites[index % project.sites.length],
            name: item[0],
            unit: item[1],
            requested,
            approved,
            purchased,
            consumed,
            vendor: item[2],
            poNumber: `PO-${3000 + index}`,
            status: index % 5 === 0 ? "Pending" : "Approved",
          };
        }),
        ...rows,
      ]);
    }

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

    const expenseDescriptions = ["Petrol and water cans", "Brush and hammer set", "Safety gloves", "Site transport", "Office print and courier", "Temporary lighting", "Tea and labour refreshments"];
    if (!this.expenses().some((row) => row.id.startsWith("DEMO-EXP-"))) {
      this.expenses.update((rows) => [
        ...Array.from({ length: 50 }, (_, index): ExpenseRow => {
          const project = seededProjects[index % seededProjects.length];
          const received = index % 10 === 0 ? 15000 + index * 120 : 0;
          const spent = 180 + (index % 11) * 265;
          return {
            id: `DEMO-EXP-${String(index + 1).padStart(3, "0")}`,
            projectId: project.id,
            site: project.sites[(index + 2) % project.sites.length],
            supervisor: project.supervisor,
            date: `2026-06-${String(1 + (index % 26)).padStart(2, "0")}`,
            description: expenseDescriptions[index % expenseDescriptions.length],
            type: index % 8 === 0 ? "General Expense" : "Site Expense",
            received,
            spent,
            reference: `EXP-${4200 + index}`,
            status: index % 6 === 0 ? "Pending" : "Approved",
          };
        }),
        ...rows,
      ]);
    }

    this.writeState(seedKey, true);
  }

  addClient(input: { name: string; mobile: string; address: string; supervisor: string }): Client {
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
      status: "Active",
      projectIds: [],
      supervisor: input.supervisor,
    };

    this.clients.update((clients) => [client, ...clients]);
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

    return updatedProject;
  }

  expenseOpeningBalanceFor(projectId: string, siteName: string): number | undefined {
    const key = this.expenseOpeningBalanceKey(projectId, siteName);
    return this.expenseOpeningBalances()[key];
  }

  setExpenseOpeningBalance(projectId: string, siteName: string, amount: number) {
    const key = this.expenseOpeningBalanceKey(projectId, siteName);
    this.expenseOpeningBalances.update((balances) => ({ ...balances, [key]: amount }));
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

    return updatedProject;
  }

  deleteProject(projectId: string) {
    this.projects.update((projectRows) => projectRows.filter((project) => project.id !== projectId));
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
    return this.projects().filter((project) => client.projectIds.includes(project.id));
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
    return nextRow;
  }

  updateSharedRowCell(rowId: string, key: string, value: string | number) {
    if (!rowId) return;

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
  }

  deleteSharedRow(rowId: string) {
    if (!rowId) return;
    this.customTableRows.update((rows) => {
      const nextRows = Object.fromEntries(
        Object.entries(rows).map(([module, moduleRows]) => [module, moduleRows.filter((row) => String(row["__rowId"] || "") !== rowId)]),
      ) as Record<SharedModuleKey, SharedTableRow[]>;
      return nextRows;
    });
    this.hiddenTableRows.update((rowIds) => (rowIds.includes(rowId) ? rowIds : [...rowIds, rowId]));
  }

  clientSummary(client: Client) {
    const clientProjects = this.projectsForClient(client);
    const totalValue = clientProjects.reduce((sum, project) => sum + project.totalValue, 0);
    const received = clientProjects.reduce((sum, project) => sum + project.receivedAmount, 0);
    const sites = clientProjects.reduce((sum, project) => sum + project.sites.length, 0);
    const materialCost = clientProjects.reduce((sum, project) => sum + project.materialSpend, 0);
    const labourCost = clientProjects.reduce((sum, project) => sum + project.labourPayable, 0);
    const siteExpense = clientProjects.reduce((sum, project) => sum + project.expenseBalance, 0);

    return {
      projectCount: clientProjects.length,
      activeSites: sites,
      totalValue,
      received,
      pending: totalValue - received,
      materialCost,
      labourCost,
      siteExpense,
      activeLabour: this.labour()
        .filter((row) => clientProjects.some((project) => project.id === row.projectId))
        .reduce((sum, row) => sum + row.presentCount, 0),
    };
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
}
