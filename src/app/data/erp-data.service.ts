import { Injectable, computed, signal } from "@angular/core";
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

@Injectable({ providedIn: "root" })
export class ErpDataService {
  readonly clients = signal<Client[]>([
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
  ]);

  readonly projects = signal<Project[]>(projects);
  readonly materials = signal<MaterialRow[]>(materials);
  readonly labour = signal<LabourRow[]>(labour);
  readonly expenses = signal<ExpenseRow[]>(expenses);
  readonly payments = signal<PaymentRow[]>(payments);
  readonly vendors = signal<Vendor[]>([
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
  ]);

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
    "Project Summary",
    "Site Summary",
  ]);

  readonly activeClients = computed(() => this.clients().filter((client) => client.status === "Active").length);

  addClient(input: { name: string; mobile: string; address: string; supervisor: string }): Client {
    const nextNumber = 1001 + this.clients().length;
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

  addProject(
    client: Client,
    input: { name: string; sites: string[]; startDate: string; supervisor: string; totalValue: number; advanceAmount: number },
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
      status: "Active",
      startDate: input.startDate,
      totalValue: input.totalValue,
      advanceAmount: input.advanceAmount,
      receivedAmount: input.advanceAmount,
      materialSpend: 0,
      labourPayable: 0,
      expenseBalance: 0,
      completion: 0,
    };

    this.projects.update((projects) => [project, ...projects]);
    this.clients.update((clients) =>
      clients.map((existingClient) =>
        existingClient.id === client.id ? { ...existingClient, projectIds: [project.id, ...existingClient.projectIds] } : existingClient,
      ),
    );
    return project;
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
}
