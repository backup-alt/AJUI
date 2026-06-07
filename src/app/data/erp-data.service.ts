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

export type SharedModuleKey =
  | "materials"
  | "clients"
  | "labour"
  | "expenses"
  | "generalExpenses"
  | "payments"
  | "vendors"
  | "reports"
  | "settings";
export type SharedFieldType = "text" | "number" | "date";
export type SharedTableField = { key: string; label: string; type?: SharedFieldType };
export type SharedTableRow = Record<string, string | number | undefined>;

@Injectable({ providedIn: "root" })
export class ErpDataService {
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
  readonly customTableFields = signal<Record<SharedModuleKey, SharedTableField[]>>(
    this.readState<Record<SharedModuleKey, SharedTableField[]>>("customTableFields", this.emptySharedFieldMap()),
  );
  readonly customTableRows = signal<Record<SharedModuleKey, SharedTableRow[]>>(
    this.readState<Record<SharedModuleKey, SharedTableRow[]>>("customTableRows", this.emptySharedRowMap()),
  );
  readonly tableCellEdits = signal<Record<string, SharedTableRow>>(this.readState<Record<string, SharedTableRow>>("tableCellEdits", {}));
  readonly hiddenTableRows = signal<string[]>(this.readState<string[]>("hiddenTableRows", []));

  constructor() {
    effect(() => this.writeState("clients", this.clients()));
    effect(() => this.writeState("projects", this.projects()));
    effect(() => this.writeState("materials", this.materials()));
    effect(() => this.writeState("labour", this.labour()));
    effect(() => this.writeState("expenses", this.expenses()));
    effect(() => this.writeState("payments", this.payments()));
    effect(() => this.writeState("vendors", this.vendors()));
    effect(() => this.writeState("customTableFields", this.customTableFields()));
    effect(() => this.writeState("customTableRows", this.customTableRows()));
    effect(() => this.writeState("tableCellEdits", this.tableCellEdits()));
    effect(() => this.writeState("hiddenTableRows", this.hiddenTableRows()));
  }

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
    this.clients.update((clients) => clients.filter((client) => client.id !== clientId));
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

  updateProject(
    projectId: string,
    patch: Partial<Pick<Project, "name" | "sites" | "startDate" | "supervisor" | "status" | "totalValue" | "advanceAmount">>,
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
          receivedAmount: project.receivedAmount + receivedDelta,
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

  customFieldsFor(module: SharedModuleKey): SharedTableField[] {
    return this.customTableFields()[module] ?? [];
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

  tableRowsFor(module: SharedModuleKey, baseRows: SharedTableRow[] = [], predicate?: (row: SharedTableRow) => boolean): SharedTableRow[] {
    const edits = this.tableCellEdits();
    const hidden = new Set(this.hiddenTableRows());
    return [...baseRows, ...(this.customTableRows()[module] ?? [])]
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

  private emptySharedFieldMap(): Record<SharedModuleKey, SharedTableField[]> {
    return { materials: [], clients: [], labour: [], expenses: [], generalExpenses: [], payments: [], vendors: [], reports: [], settings: [] };
  }

  private emptySharedRowMap(): Record<SharedModuleKey, SharedTableRow[]> {
    return { materials: [], clients: [], labour: [], expenses: [], generalExpenses: [], payments: [], vendors: [], reports: [], settings: [] };
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
