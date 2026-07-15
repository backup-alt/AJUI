export type Role = "Admin" | "Project Manager" | "Accountant" | "Supervisor";

export type ProjectStatus = "Active" | "On Hold" | "Completed";

export type Project = {
  id: string;
  name: string;
  client: string;
  mobile: string;
  address: string;
  supervisor: string;
  sites: string[];
  status: ProjectStatus;
  startDate: string;
  totalValue: number;
  advanceAmount: number;
  receivedAmount: number;
  materialSpend: number;
  labourPayable: number;
  expenseBalance: number;
  completion: number;
};

export type ApprovalStatus = "Pending" | "Approved" | "Rejected";

export type Approval = {
  id: string;
  type: "Material" | "Attendance" | "Expense" | "Payment";
  title: string;
  projectId: string;
  site: string;
  owner: string;
  amount: number;
  detail: string;
  submittedAt: string;
  status: ApprovalStatus;
};

export type MaterialRow = {
  id: string;
  projectId: string;
  site: string;
  name: string;
  unit: string;
  requested: number;
  approved: number;
  purchased: number;
  consumed: number;
  vendor: string;
  poNumber: string;
  status: ApprovalStatus;
  purchasedDate?: string;
  issuedAmount?: number;
  givenAmount?: number;
  paymentType?: "Cash" | "NEFT" | "Bank Transfer" | "UPI" | "Cheque";
  deliveredOn?: string;
};

export type QuotationRow = {
  id: string;
  sno: number;
  description: string;
  unit: string;
  qty: number;
  rate: number;
  amount: number;
  isCustom?: boolean;
};

export type Quotation = {
  id: string;
  quotationNumber: string;
  date: string;
  companyName: string;
  companyAddress: string;
  state: string;
  gstin: string;
  clientName: string;
  clientAddress: string;
  clientState: string;
  clientGstin: string;
  items: QuotationRow[];
  customColumns: string[];
  subtotal: number;
  cgstPercent: number;
  sgstPercent: number;
  cgstAmount: number;
  sgstAmount: number;
  roundOff: number;
  totalAmount: number;
  amountInWords: string;
  status: "Draft" | "Sent" | "Accepted" | "Rejected";
  createdAt: string;
  updatedAt: string;
};

export type CompanyProfile = {
  name: string;
  address: string;
  state: string;
  gstin: string;
};

export type LabourRow = {
  id: string;
  projectId: string;
  site: string;
  party: string;
  category: string;
  dailyWage: number;
  presentDays: number;
  absentDays: number;
  presentCount: number;
  overtime: number;
  lateFine: number;
  shift: string;
  notes: string;
  paymentMode: "NEFT" | "Cash";
  status: ApprovalStatus;
};

export type ExpenseRow = {
  id: string;
  projectId: string;
  site: string;
  supervisor: string;
  date: string;
  description: string;
  type: "Site Expense" | "General Expense";
  received: number;
  spent: number;
  reference: string;
  status: ApprovalStatus;
};

export type PaymentRow = {
  id: string;
  projectId: string;
  date: string;
  amount: number;
  mode: "Cash" | "Bank Transfer" | "Cheque" | "UPI" | "NEFT";
  receipt: string;
  reference: string;
  collectedBy: string;
  status: ApprovalStatus;
};

export const roles: Role[] = ["Admin", "Project Manager", "Accountant", "Supervisor"];

export const projects: Project[] = [
  {
    id: "AB-1024",
    name: "Green Nest Villas",
    client: "Meenakshi Raman",
    mobile: "+91 98402 11880",
    address: "Plot 42, Velachery Main Road, Chennai",
    supervisor: "R. Karthik",
    sites: ["Area 1", "Area 2", "Area 3"],
    status: "Active",
    startDate: "2026-05-02",
    totalValue: 8200000,
    advanceAmount: 1800000,
    receivedAmount: 4675000,
    materialSpend: 1265000,
    labourPayable: 318500,
    expenseBalance: 74500,
    completion: 58,
  },
  {
    id: "AB-1031",
    name: "Kaveri Flats Renovation",
    client: "Dhanraj & Co",
    mobile: "+91 97911 40590",
    address: "Second Avenue, Anna Nagar, Chennai",
    supervisor: "S. Prabhu",
    sites: ["Ground Floor", "First Floor", "Terrace"],
    status: "Active",
    startDate: "2026-04-18",
    totalValue: 4650000,
    advanceAmount: 900000,
    receivedAmount: 2410000,
    materialSpend: 785000,
    labourPayable: 176800,
    expenseBalance: 32500,
    completion: 42,
  },
  {
    id: "AB-1008",
    name: "Lakshmi Nagar Duplex",
    client: "Arun Subramani",
    mobile: "+91 98840 77012",
    address: "Lakshmi Nagar, Porur, Chennai",
    supervisor: "M. Saravanan",
    sites: ["Block A", "Block B"],
    status: "On Hold",
    startDate: "2026-03-11",
    totalValue: 7300000,
    advanceAmount: 1200000,
    receivedAmount: 3350000,
    materialSpend: 1050000,
    labourPayable: 109200,
    expenseBalance: 18800,
    completion: 36,
  },
];

export const approvals: Approval[] = [
  {
    id: "APR-221",
    type: "Material",
    title: "Cement bags for roof slab",
    projectId: "AB-1024",
    site: "Area 2",
    owner: "R. Karthik",
    amount: 86500,
    detail: "120 bags requested, 100 bags recommended after site check",
    submittedAt: "Today, 9:10 AM",
    status: "Pending",
  },
  {
    id: "APR-222",
    type: "Expense",
    title: "Transport and water supply",
    projectId: "AB-1024",
    site: "Area 1",
    owner: "R. Karthik",
    amount: 12850,
    detail: "TC-135, TC-136 bills attached for local purchases",
    submittedAt: "Today, 11:35 AM",
    status: "Pending",
  },
  {
    id: "APR-223",
    type: "Attendance",
    title: "Mason party weekly attendance",
    projectId: "AB-1031",
    site: "First Floor",
    owner: "S. Prabhu",
    amount: 114000,
    detail: "Mason - 8, Helper - 5, night shift on Friday",
    submittedAt: "Yesterday, 6:40 PM",
    status: "Pending",
  },
  {
    id: "APR-224",
    type: "Payment",
    title: "Client receipt verification",
    projectId: "AB-1008",
    site: "Block A",
    owner: "Anitha",
    amount: 350000,
    detail: "UPI reference pending accountant approval",
    submittedAt: "Yesterday, 3:20 PM",
    status: "Pending",
  },
];

export const materials: MaterialRow[] = [
  {
    id: "MAT-450",
    projectId: "AB-1024",
    site: "Area 1",
    name: "Bricks",
    unit: "Nos",
    requested: 12000,
    approved: 10000,
    purchased: 10000,
    consumed: 7250,
    vendor: "Sri Devi Traders",
    poNumber: "PO-1041",
    status: "Approved",
    purchasedDate: "2026-05-15",
    issuedAmount: 85000,
    givenAmount: 80000,
    paymentType: "NEFT",
    deliveredOn: "2026-05-18",
  },
  {
    id: "MAT-451",
    projectId: "AB-1024",
    site: "Area 2",
    name: "Cement",
    unit: "Bag",
    requested: 120,
    approved: 0,
    purchased: 0,
    consumed: 0,
    vendor: "KMS Agencies",
    poNumber: "Pending",
    status: "Pending",
    purchasedDate: undefined,
    issuedAmount: 0,
    givenAmount: 0,
    paymentType: undefined,
    deliveredOn: undefined,
  },
  {
    id: "MAT-452",
    projectId: "AB-1024",
    site: "Area 3",
    name: "Steel Rod",
    unit: "Kg",
    requested: 2400,
    approved: 2200,
    purchased: 2200,
    consumed: 1310,
    vendor: "Amman Steel",
    poNumber: "PO-1045",
    status: "Approved",
    purchasedDate: "2026-05-20",
    issuedAmount: 165000,
    givenAmount: 160000,
    paymentType: "UPI",
    deliveredOn: "2026-05-22",
  },
  {
    id: "MAT-453",
    projectId: "AB-1031",
    site: "First Floor",
    name: "M-Sand",
    unit: "Load",
    requested: 8,
    approved: 6,
    purchased: 6,
    consumed: 4,
    vendor: "Thirumalai Blue Metals",
    poNumber: "PO-1050",
    status: "Approved",
    purchasedDate: "2026-05-25",
    issuedAmount: 48000,
    givenAmount: 45000,
    paymentType: "Cash",
    deliveredOn: "2026-05-26",
  },
];

export const labour: LabourRow[] = [
  {
    id: "LAB-118",
    projectId: "AB-1024",
    site: "Area 1",
    party: "Velu Mason Party",
    category: "Mason",
    dailyWage: 950,
    presentDays: 6,
    absentDays: 1,
    presentCount: 7,
    overtime: 4,
    lateFine: 0,
    shift: "1.00",
    notes: "Mason - 5, Helper - 2",
    paymentMode: "NEFT",
    status: "Approved",
  },
  {
    id: "LAB-119",
    projectId: "AB-1024",
    site: "Area 2",
    party: "Ganesh Plumbing",
    category: "Plumber",
    dailyWage: 1100,
    presentDays: 5,
    absentDays: 2,
    presentCount: 3,
    overtime: 0,
    lateFine: 250,
    shift: "Day",
    notes: "Pipe chasing completed",
    paymentMode: "Cash",
    status: "Pending",
  },
  {
    id: "LAB-120",
    projectId: "AB-1031",
    site: "First Floor",
    party: "Selvam Civil Works",
    category: "Civil",
    dailyWage: 900,
    presentDays: 6,
    absentDays: 0,
    presentCount: 13,
    overtime: 8,
    lateFine: 0,
    shift: "Night",
    notes: "Mason - 8, Helper - 5",
    paymentMode: "NEFT",
    status: "Pending",
  },
];

export const expenses: ExpenseRow[] = [
  {
    id: "EXP-701",
    projectId: "AB-1024",
    site: "Area 1",
    supervisor: "R. Karthik",
    date: "2026-06-05",
    description: "Petrol, water can, bus ticket",
    type: "Site Expense",
    received: 25000,
    spent: 12850,
    reference: "TC-135 / TC-136",
    status: "Pending",
  },
  {
    id: "EXP-702",
    projectId: "AB-1024",
    site: "Area 3",
    supervisor: "R. Karthik",
    date: "2026-06-04",
    description: "Bar bending labour advance",
    type: "Site Expense",
    received: 0,
    spent: 18500,
    reference: "Cash voucher",
    status: "Approved",
  },
  {
    id: "EXP-703",
    projectId: "AB-1031",
    site: "Ground Floor",
    supervisor: "S. Prabhu",
    date: "2026-06-03",
    description: "Office print and courier",
    type: "General Expense",
    received: 10000,
    spent: 2800,
    reference: "GEN-44",
    status: "Approved",
  },
];

export const payments: PaymentRow[] = [
  {
    id: "PAY-310",
    projectId: "AB-1024",
    date: "2026-06-04",
    amount: 500000,
    mode: "NEFT",
    receipt: "RCT-1882",
    reference: "UTR 6129042",
    collectedBy: "Anitha",
    status: "Approved",
  },
  {
    id: "PAY-311",
    projectId: "AB-1031",
    date: "2026-06-01",
    amount: 300000,
    mode: "UPI",
    receipt: "RCT-1883",
    reference: "UPI 5140",
    collectedBy: "Anitha",
    status: "Approved",
  },
  {
    id: "PAY-312",
    projectId: "AB-1008",
    date: "2026-05-30",
    amount: 350000,
    mode: "UPI",
    receipt: "RCT-1884",
    reference: "Pending",
    collectedBy: "Anitha",
    status: "Pending",
  },
];
