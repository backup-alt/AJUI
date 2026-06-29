import { Injectable, signal, computed } from '@angular/core';
import {
  User,
  Project,
  MaterialRequest,
  LabourAttendance,
  SiteExpense,
  PaymentRecord,
  Subcontract,
  ActivityItem,
  DashboardStats,
} from '../models/types';

const SUPERVISOR_ID = 'usr-001';

@Injectable({ providedIn: 'root' })
export class MockDataService {
  // Current user (logged-in supervisor)
  readonly currentUser = signal<User>({
    id: SUPERVISOR_ID,
    name: 'Rajesh Kumar',
    phone: '+91 98765 43210',
    email: 'rajesh.kumar@agbuilders.com',
    role: 'supervisor',
    status: 'active',
    baseLocation: 'Chennai, Tamil Nadu',
    assignedProjectIds: ['proj-001', 'proj-002', 'proj-003'],
    createdAt: '2026-01-15T09:00:00.000Z',
    lastLoginAt: new Date().toISOString(),
  });

  // Projects assigned to supervisor
  readonly projects = signal<Project[]>([
    {
      id: 'proj-001',
      projectId: 'AB-1024',
      name: 'Villa Project — Sri Balaji Nagar',
      client: 'Mr. Karthik Raj',
      clientId: 'cli-001',
      mobile: '+91 98423 11122',
      address: 'Plot 14, Sri Balaji Nagar, OMR, Chennai',
      supervisor: 'Rajesh Kumar',
      status: 'Active',
      startDate: '2026-03-01',
      totalValue: 8500000,
      receivedAmount: 5200000,
      pendingBalance: 3300000,
      materialSpend: 1850000,
      labourPayable: 425000,
      expenseBalance: 168000,
      completion: 62,
      sites: [
        { id: 'site-001', name: 'Main Building', projectId: 'proj-001', status: 'Active' },
        { id: 'site-002', name: 'Compound Wall', projectId: 'proj-001', status: 'Active' },
        { id: 'site-003', name: 'Landscaping', projectId: 'proj-001', status: 'Active' },
      ],
    },
    {
      id: 'proj-002',
      projectId: 'GH-220',
      name: 'Apartment Block — Green Heights',
      client: 'Mr. Suresh Babu',
      clientId: 'cli-002',
      mobile: '+91 99884 22110',
      address: 'Green Heights Apartments, T. Nagar, Chennai',
      supervisor: 'Rajesh Kumar',
      status: 'Active',
      startDate: '2026-02-10',
      totalValue: 22000000,
      receivedAmount: 11200000,
      pendingBalance: 10800000,
      materialSpend: 4250000,
      labourPayable: 1120000,
      expenseBalance: 348000,
      completion: 38,
      sites: [
        { id: 'site-004', name: 'Block A — Ground Floor', projectId: 'proj-002', status: 'Active' },
        { id: 'site-005', name: 'Block A — First Floor', projectId: 'proj-002', status: 'Active' },
      ],
    },
    {
      id: 'proj-003',
      projectId: 'RS-090',
      name: 'Renovation — Riverside Duplex',
      client: 'Mrs. Priya Anand',
      clientId: 'cli-003',
      mobile: '+91 90030 88012',
      address: '12, Riverside Drive, ECR, Chennai',
      supervisor: 'Rajesh Kumar',
      status: 'On Hold',
      startDate: '2025-11-20',
      totalValue: 3200000,
      receivedAmount: 2880000,
      pendingBalance: 320000,
      materialSpend: 1180000,
      labourPayable: 215000,
      expenseBalance: 42000,
      completion: 90,
      sites: [
        { id: 'site-006', name: 'Duplex — Ground Floor', projectId: 'proj-003', status: 'Active' },
      ],
    },
  ]);

  // Material requests
  readonly materials = signal<MaterialRequest[]>([
    {
      id: 'mat-001',
      materialId: 'MAT-1024',
      projectId: 'proj-001',
      projectName: 'Villa Project — Sri Balaji Nagar',
      site: 'Main Building',
      name: 'Cement',
      category: 'Cement',
      unit: 'Bag',
      requestedQuantity: 50,
      vendor: 'Anbu Cements',
      poNumber: 'PO-25-014',
      expectedDeliveryDate: '2026-06-30',
      notes: 'For roof slab casting',
      status: 'Pending',
      submittedAt: this.daysAgo(0, 9, 15),
    },
    {
      id: 'mat-002',
      materialId: 'MAT-1025',
      projectId: 'proj-001',
      projectName: 'Villa Project — Sri Balaji Nagar',
      site: 'Main Building',
      name: 'TMT Steel 12mm',
      category: 'Steel',
      unit: 'Kg',
      requestedQuantity: 800,
      vendor: 'Steel Authority',
      poNumber: 'PO-25-015',
      status: 'Approved',
      submittedAt: this.daysAgo(1, 10, 30),
      reviewedAt: this.daysAgo(0, 14, 0),
      reviewedBy: 'Admin',
    },
    {
      id: 'mat-003',
      materialId: 'MAT-1026',
      projectId: 'proj-002',
      projectName: 'Apartment Block — Green Heights',
      site: 'Block A — Ground Floor',
      name: 'M-Sand',
      category: 'Sand',
      unit: 'Cum',
      requestedQuantity: 4,
      vendor: 'Trichy Sand Suppliers',
      status: 'Pending',
      submittedAt: this.daysAgo(0, 8, 0),
    },
    {
      id: 'mat-004',
      materialId: 'MAT-1027',
      projectId: 'proj-002',
      projectName: 'Apartment Block — Green Heights',
      site: 'Block A — First Floor',
      name: 'Chamber Bricks',
      category: 'Bricks',
      unit: 'Nos',
      requestedQuantity: 2000,
      vendor: 'Kaveri Bricks',
      poNumber: 'PO-25-016',
      status: 'Rejected',
      submittedAt: this.daysAgo(2, 11, 0),
      reviewedAt: this.daysAgo(1, 9, 30),
      reviewedBy: 'Project Manager',
      rejectionReason: 'Quantity exceeds this month’s budget. Resubmit with revised count.',
    },
    {
      id: 'mat-005',
      materialId: 'MAT-1028',
      projectId: 'proj-001',
      projectName: 'Villa Project — Sri Balaji Nagar',
      site: 'Compound Wall',
      name: 'Vitrified Tiles 600x600',
      category: 'Tiles',
      unit: 'Sqft',
      requestedQuantity: 850,
      status: 'Approved',
      submittedAt: this.daysAgo(4, 9, 0),
      reviewedAt: this.daysAgo(3, 11, 0),
      reviewedBy: 'Admin',
    },
  ]);

  // Labour attendance
  readonly labour = signal<LabourAttendance[]>([
    {
      id: 'lab-001',
      labourId: 'LAB-2201',
      projectId: 'proj-001',
      projectName: 'Villa Project — Sri Balaji Nagar',
      site: 'Main Building',
      attendanceDate: this.today(),
      category: 'Mason',
      laborTypes: [
        { name: 'Mason', dailyWage: 850, staffCount: 6 },
        { name: 'Helper', dailyWage: 500, staffCount: 8 },
      ],
      totalWorkers: 14,
      totalWages: 9100,
      weather: 'Sunny',
      status: 'Pending',
      submittedAt: this.daysAgo(0, 8, 45),
    },
    {
      id: 'lab-002',
      labourId: 'LAB-2200',
      projectId: 'proj-002',
      projectName: 'Apartment Block — Green Heights',
      site: 'Block A — Ground Floor',
      attendanceDate: this.today(),
      category: 'Plumber',
      partyName: 'Kumar Plumbing Works',
      laborTypes: [{ name: 'Plumber', dailyWage: 900, staffCount: 4 }],
      totalWorkers: 4,
      totalWages: 3600,
      weather: 'Cloudy',
      status: 'Approved',
      submittedAt: this.daysAgo(0, 9, 0),
      reviewedAt: this.daysAgo(0, 12, 30),
      reviewedBy: 'Admin',
    },
    {
      id: 'lab-003',
      labourId: 'LAB-2199',
      projectId: 'proj-001',
      projectName: 'Villa Project — Sri Balaji Nagar',
      site: 'Main Building',
      attendanceDate: this.daysAgoIso(1),
      category: 'Electrician',
      partyName: 'Anu Electricals',
      laborTypes: [{ name: 'Electrician', dailyWage: 950, staffCount: 3 }],
      totalWorkers: 3,
      totalWages: 2850,
      weather: 'Sunny',
      status: 'Approved',
      submittedAt: this.daysAgo(1, 8, 30),
      reviewedAt: this.daysAgo(1, 13, 0),
      reviewedBy: 'Admin',
    },
  ]);

  // Site expenses
  readonly expenses = signal<SiteExpense[]>([
    {
      id: 'exp-001',
      expenseId: 'EXP-5401',
      type: 'site',
      projectId: 'proj-001',
      projectName: 'Villa Project — Sri Balaji Nagar',
      site: 'Main Building',
      category: 'Diesel',
      amount: 3200,
      reference: 'Receipt #DT-9981',
      description: 'Diesel for mixer machine and pump',
      mode: 'Cash',
      expenseDate: this.today(),
      status: 'Pending',
      submittedAt: this.daysAgo(0, 10, 32),
    },
    {
      id: 'exp-002',
      expenseId: 'EXP-5400',
      type: 'site',
      projectId: 'proj-002',
      projectName: 'Apartment Block — Green Heights',
      site: 'Block A — Ground Floor',
      category: 'Site Tea',
      amount: 480,
      description: 'Morning tea and snacks for 18 workers',
      mode: 'Cash',
      expenseDate: this.today(),
      status: 'Approved',
      submittedAt: this.daysAgo(0, 11, 0),
      reviewedAt: this.daysAgo(0, 14, 30),
      reviewedBy: 'Accountant',
    },
    {
      id: 'exp-003',
      expenseId: 'EXP-5399',
      type: 'site',
      projectId: 'proj-001',
      projectName: 'Villa Project — Sri Balaji Nagar',
      site: 'Main Building',
      category: 'Equipment Rental',
      amount: 4500,
      reference: 'INV-2026-441',
      description: 'Concrete mixer rental — 3 days',
      mode: 'UPI',
      expenseDate: this.daysAgoIso(1),
      status: 'Pending',
      submittedAt: this.daysAgo(1, 17, 15),
    },
    {
      id: 'exp-004',
      expenseId: 'EXP-5398',
      type: 'general',
      projectId: 'proj-001',
      projectName: 'Villa Project — Sri Balaji Nagar',
      site: 'Main Building',
      category: 'Transport',
      amount: 1250,
      reference: 'Receipt #TX-7711',
      description: 'Material pickup from Anbu Cements',
      mode: 'Cash',
      expenseDate: this.daysAgoIso(2),
      status: 'Approved',
      submittedAt: this.daysAgo(2, 16, 30),
      reviewedAt: this.daysAgo(2, 18, 0),
      reviewedBy: 'Admin',
    },
    {
      id: 'exp-005',
      expenseId: 'EXP-5397',
      type: 'site',
      projectId: 'proj-003',
      projectName: 'Renovation — Riverside Duplex',
      site: 'Duplex — Ground Floor',
      category: 'Petty Cash',
      amount: 800,
      description: 'Misc small items',
      mode: 'Cash',
      expenseDate: this.daysAgoIso(3),
      status: 'Rejected',
      submittedAt: this.daysAgo(3, 13, 0),
      reviewedAt: this.daysAgo(3, 15, 0),
      reviewedBy: 'Accountant',
      rejectionReason: 'Please attach itemized bill for amounts over ₹500.',
    },
  ]);

  // Payments
  readonly payments = signal<PaymentRecord[]>([
    {
      id: 'pay-001',
      paymentId: 'PAY-3301',
      projectId: 'proj-001',
      projectName: 'Villa Project — Sri Balaji Nagar',
      clientId: 'cli-001',
      clientName: 'Mr. Karthik Raj',
      amount: 500000,
      mode: 'Bank Transfer',
      receiptNumber: 'RCP-2026-0098',
      transactionReference: 'NEFT-SBI-441290',
      collectedBy: 'Rajesh Kumar',
      paymentDate: this.today(),
      status: 'Pending',
      submittedAt: this.daysAgo(0, 11, 30),
    },
    {
      id: 'pay-002',
      paymentId: 'PAY-3300',
      projectId: 'proj-002',
      projectName: 'Apartment Block — Green Heights',
      clientId: 'cli-002',
      clientName: 'Mr. Suresh Babu',
      amount: 1200000,
      mode: 'UPI',
      receiptNumber: 'RCP-2026-0097',
      transactionReference: 'UPI-99881234',
      collectedBy: 'Rajesh Kumar',
      paymentDate: this.daysAgoIso(1),
      status: 'Approved',
      submittedAt: this.daysAgo(1, 14, 0),
      reviewedAt: this.daysAgo(1, 16, 0),
      reviewedBy: 'Accountant',
    },
  ]);

  // Subcontracts
  readonly subcontracts = signal<Subcontract[]>([
    {
      id: 'sub-001',
      contractId: 'SC-501',
      projectId: 'proj-001',
      projectName: 'Villa Project — Sri Balaji Nagar',
      site: 'Main Building',
      name: 'Kumar Plumbing Works',
      scope: 'Complete plumbing work for ground + first floor including fixtures',
      agreementAmount: 180000,
      advanceAmount: 50000,
      paidAmount: 90000,
      startDate: '2026-04-01',
      endDate: '2026-08-30',
      phone: '+91 98420 11122',
      gstNumber: '33ABCDE1234F1Z5',
      status: 'Approved',
      submittedAt: this.daysAgo(20, 10, 0),
      reviewedAt: this.daysAgo(19, 12, 0),
      reviewedBy: 'Admin',
    },
    {
      id: 'sub-002',
      contractId: 'SC-502',
      projectId: 'proj-002',
      projectName: 'Apartment Block — Green Heights',
      site: 'Block A — Ground Floor',
      name: 'Anu Electricals',
      scope: 'Concealed wiring, DB installation, switchboards for Block A',
      agreementAmount: 95000,
      advanceAmount: 25000,
      paidAmount: 25000,
      startDate: '2026-05-15',
      endDate: '2026-09-15',
      phone: '+91 90030 77712',
      gstNumber: '33XYZAB5678G2Z9',
      status: 'Pending',
      submittedAt: this.daysAgo(2, 11, 0),
    },
  ]);

  // Computed stats
  readonly stats = computed<DashboardStats>(() => {
    const today = this.today();
    const todayExpenses = this.expenses().filter((e) => e.expenseDate === today);
    const pending = [
      ...this.materials().filter((m) => m.status === 'Pending'),
      ...this.labour().filter((l) => l.status === 'Pending'),
      ...this.expenses().filter((e) => e.status === 'Pending'),
      ...this.payments().filter((p) => p.status === 'Pending'),
      ...this.subcontracts().filter((s) => s.status === 'Pending'),
    ];
    const materialsThisWeek = this.materials().filter((m) => {
      const submitted = new Date(m.submittedAt);
      const now = new Date();
      const diffDays = (now.getTime() - submitted.getTime()) / (1000 * 60 * 60 * 24);
      return diffDays <= 7;
    });
    const workersToday = this.labour()
      .filter((l) => l.attendanceDate === today)
      .reduce((sum, l) => sum + l.totalWorkers, 0);

    return {
      activeProjects: this.projects().filter((p) => p.status === 'Active').length,
      todayExpense: todayExpenses.reduce((sum, e) => sum + e.amount, 0),
      todayExpenseCount: todayExpenses.length,
      pendingApprovals: pending.length,
      materialsLoggedThisWeek: materialsThisWeek.length,
      workersToday,
    };
  });

  // Recent activity feed
  readonly recentActivity = computed<ActivityItem[]>(() => {
    const items: ActivityItem[] = [];
    this.materials().forEach((m) =>
      items.push({
        id: m.id,
        source: 'material',
        title: `${m.name} (${m.requestedQuantity} ${m.unit})`,
        subtitle: `${m.projectName} · ${m.site}`,
        status: m.status,
        submittedAt: m.submittedAt,
      })
    );
    this.labour().forEach((l) =>
      items.push({
        id: l.id,
        source: 'labour',
        title: `Labour — ${l.totalWorkers} workers`,
        subtitle: `${l.projectName} · ${l.site}`,
        status: l.status,
        submittedAt: l.submittedAt,
      })
    );
    this.expenses().forEach((e) =>
      items.push({
        id: e.id,
        source: 'expense',
        title: `${e.category}`,
        subtitle: `${e.projectName} · ${e.site}`,
        amount: e.amount,
        status: e.status,
        submittedAt: e.submittedAt,
      })
    );
    this.payments().forEach((p) =>
      items.push({
        id: p.id,
        source: 'payment',
        title: `Payment — ${p.clientName}`,
        subtitle: p.projectName,
        amount: p.amount,
        status: p.status,
        submittedAt: p.submittedAt,
      })
    );
    this.subcontracts().forEach((s) =>
      items.push({
        id: s.id,
        source: 'subcontract',
        title: s.name,
        subtitle: `${s.projectName} · ${s.scope.substring(0, 40)}...`,
        amount: s.agreementAmount,
        status: s.status,
        submittedAt: s.submittedAt,
      })
    );
    return items
      .sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime())
      .slice(0, 8);
  });

  // Helpers
  getProjectById(id: string): Project | undefined {
    return this.projects().find((p) => p.id === id);
  }

  getSitesByProject(projectId: string) {
    return this.projects().find((p) => p.id === projectId)?.sites ?? [];
  }

  updateUser(updates: Partial<User>) {
    this.currentUser.update((u) => ({ ...u, ...updates }));
  }

  // Date helpers (deterministic so screenshots are stable)
  private today(): string {
    const d = new Date(2026, 5, 29); // 2026-06-29 (matches env date)
    return d.toISOString().split('T')[0];
  }

  private daysAgoIso(days: number): string {
    const d = new Date(2026, 5, 29 - days);
    return d.toISOString().split('T')[0];
  }

  private daysAgo(days: number, hour: number, minute: number): string {
    const d = new Date(2026, 5, 29 - days, hour, minute, 0);
    return d.toISOString();
  }
}