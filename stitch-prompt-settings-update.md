=================================================================
[14] 14-settings.html — RESTRUCTURED (Windows 11-style)
=================================================================

DESIGN PATTERN: WINDOWS 11 SETTINGS LAYOUT
--------------------------------------------
- Two-pane layout: left navigation list, right detail panel
- Left pane: 280px wide, fixed, white surface, subtle right border
  - Each item is a tall rectangular card (60-72px height, full width minus padding)
  - Hover: bg #f1f5f9, left border 3px #002263 (only on hover/active)
  - Active: bg #f1f5f9, left border 3px #002263, text #002263 bold
  - Each item has: inline SVG icon (24x24, left) + title (16px medium) + subtitle (12px muted, optional)
  - Search bar at top of left pane
  - Items grouped by category headers ("Personal", "Management", "System")
- Right pane: flexible width, scrolls independently
  - Page title (h1, 28px, semibold)
  - Breadcrumb (Settings > {Section Name}) at top
  - Content cards: white, 1px border, radius 10, generous padding (24-32px)
  - Cards have section title (h2, 18px) + description (14px muted) + content

LEFT PANE STRUCTURE (in order):
-------------------------------
PERSONAL
  - Account                    → /settings/account
  - Notifications              → /settings/notifications
  - Appearance                 → /settings/appearance (NEW: Theme settings)

MANAGEMENT
  - Roles and Employees        → /settings/roles (NEW)
  - Sites Directory            → /settings/sites (MOVED from /sites)
  - Supervisors Directory      → /settings/supervisors (MOVED from /supervisors)
  - Approval Rules             → /settings/approvals
  - Access Schedule            → /settings/access-schedule (NEW: Untimed Management)

SYSTEM
  - Devices                    → /settings/devices
  - Sessions                   → /settings/sessions
  - Reports Settings           → /settings/reports
  - Data & Privacy             → /settings/privacy
  - About                      → /settings/about

(For Stitch: the left pane is the same shell across all settings sub-pages.
Build it as a reusable component in 00-components.html first.)

=================================================================
[14a] Settings Sub-page: Account (unchanged from previous spec)
=================================================================
Same as before: name, email, phone (read-only if from invite), "Change password" modal.

=================================================================
[14b] Settings Sub-page: Notifications (unchanged)
=================================================================
Same as before: toggles for "Push: New submission", "Push: Approval decision",
"Email digest: Daily", "Email digest: Weekly".

=================================================================
[14c] Settings Sub-page: Appearance (NEW — THEME SETTINGS)
=================================================================
Purpose: Admin can switch the visual theme of the web app.

Layout (right pane):
  - Page title: "Appearance"
  - Breadcrumb: Settings > Appearance
  - Section 1: "Theme"
    - Description: "Choose how AGB Admin Console looks. Your selection applies across all your devices."
    - Three theme cards in a row (radio-card pattern):
      1. Light (default)
         - Preview: white background, dark text, #002263 accent
         - Title: "Light", Subtitle: "Classic look with white background"
         - Checkmark in top-right if selected
      2. Dark
         - Preview: #0f172a background, light text, #4a6cf7 accent
         - Title: "Dark", Subtitle: "Easier on the eyes in low light"
         - Checkmark in top-right if selected
      3. System
         - Preview: split image (half light, half dark)
         - Title: "System", Subtitle: "Match your OS preference"
         - Checkmark in top-right if selected
    - On click: apply theme class to <html>, save to localStorage
  - Section 2: "Accent color" (optional, for future)
    - Description: "Customize the highlight color used across the app."
    - 6 color swatches in a row: #002263 (default), #4a6cf7 (blue), #16a34a (green), #dc2626 (red), #f5a524 (amber), #7c3aed (purple)
    - Active swatch: 2px border in selected color, 4px outer ring
  - Section 3: "Density"
    - Description: "Adjust the spacing in lists and tables."
    - Three radio options: Comfortable (default), Compact, Roomy
    - Compact = smaller padding, smaller text in tables
  - Section 4: "Font size"
    - Slider: Small / Medium (default) / Large
    - Live preview: shows a sample paragraph at the selected size
  - Save button (bottom-right): "Apply"
    - On click: toast "Appearance updated"

Data: GET /settings/appearance, PUT /settings/appearance
{ theme: "light"|"dark"|"system", accent: hex, density: "comfortable"|"compact"|"roomy", fontSize: "sm"|"md"|"lg" }

=================================================================
[14d] Settings Sub-page: Roles and Employees (NEW)
=================================================================
Purpose: Manage which employees (admins, project managers, accountants) exist
in the system, and configure what each role can approve/decline in the
Pending Approvals section.

Layout (right pane):
  - Page title: "Roles and Employees"
  - Breadcrumb: Settings > Roles and Employees
  - Top bar: Search input (left, 320px) + "Invite Employee" primary button (right, #002263)
  - Tabs: "All Employees" | "Admins" | "Project Managers" | "Accountants" (with counts)
  - Employee list table:
    Columns: Avatar + Name, Email, Phone, Role (pill), Status (active/inactive pill), Last Login, Actions (⋯ menu)
    Default sort: Name asc
    Pagination: 20/page
  - Click row → opens right-side drawer (480px wide):
    - Header: Avatar (64px) + Name (h2) + Role pill + Status pill
    - Tabs inside drawer: "Profile" | "Permissions" | "Projects" | "Activity"
    - Profile tab: email, phone, address, joined date, last login, created by
    - Permissions tab:
      - "What {name} can approve/reject" section
      - List of approval types (Material, Labour, Expense, Payment, Subcontract) as cards
      - Each card: type icon + name + toggle (Can Approve/Reject: ON/OFF)
      - For each type: sub-toggles for "Approve" and "Reject" separately
      - Module-level permissions table (read/write/edit/hidden per field)
    - Projects tab: list of projects this user manages or is assigned to
    - Activity tab: last 20 actions (approvals, edits, logins)
    - Bottom: "Deactivate" outline button + "Save Changes" primary button
  - Invite Employee modal:
    - Name input
    - Email input
    - Phone input
    - Role dropdown: Admin / Project Manager / Accountant
    - Optional: assign to specific projects (multi-select)
    - "Send Invite" button
    - On submit: POST /settings/employees/invite → success modal with QR code (if supervisor) or success toast (if admin/PM/accountant)

Data:
  GET /settings/employees → { employees: [{ employeeId, name, email, phone, role, status, lastLoginAt, createdAt, projectIds }] }
  GET /settings/employees/:id → full profile + permissions
  PATCH /settings/employees/:id → update role/status/permissions
  POST /settings/employees/invite → { name, email, phone, role, projectIds }

=================================================================
[14e] Settings Sub-page: Sites Directory (MOVED)
=================================================================
Purpose: Neat directory of all sites in the web app, created by supervisors.

Layout (right pane):
  - Page title: "Sites"
  - Breadcrumb: Settings > Sites
  - Top bar: Search input + Project filter dropdown + Status filter + "Add Site" button (DISABLED with tooltip "Sites are created via the mobile app")
  - Site cards in a 3-column grid (NOT a table — Windows 11 settings style):
    Each card: 
    - Header: Site ID (e.g. SIT-001, small muted) + Status pill
    - Site name (h3, 18px)
    - Project(s) chips below
    - Supervisor name + avatar
    - Start date • Target end date (small, muted)
    - Bottom-right: "View Details" link
  - Click card → opens right-side drawer (560px wide):
    - Header: Site name (h1) + Site ID + Status pill
    - Tabs: "Overview" | "Activity" | "Reports"
    - Overview tab:
      - Site details: address, start date, target end date, supervisor
      - Linked projects (cards)
      - Quick stats: Active days, Submissions this month, Pending approvals
    - Activity tab: timeline of all submissions for this site
    - Reports tab: site-specific reports
    - Bottom: "Edit" button (DISABLED with tooltip) + "Archive" outline button

Data:
  GET /sites → { sites: [...] }
  GET /sites/:id → { site, projects, recentActivity }

=================================================================
[14f] Settings Sub-page: Supervisors Directory (MOVED)
=================================================================
Same as /supervisors page but in the settings layout.
Layout: Table with Supervisor ID, Name, Phone, Email, Assigned Project, Cash Limit, Approval Authority, Status.
Click row → drawer with profile + assigned projects + last 10 submissions.

=================================================================
[14g] Settings Sub-page: Approval Rules (unchanged from previous spec)
=================================================================
Same role permission matrix as before.

=================================================================
[14h] Settings Sub-page: Access Schedule (NEW — UNTIMED MANAGEMENT)
=================================================================
Purpose: Admin can define time windows during which ONLY the admin can log
in. During these windows, all other roles (PM, accountant) are blocked from
logging in or accessing settings. This is for admin-only maintenance windows.

Layout (right pane):
  - Page title: "Access Schedule"
  - Breadcrumb: Settings > Access Schedule
  - Banner (top): Warning amber banner with info icon
    "Access Schedule restricts when non-admin users can access the app.
    During restricted windows, only admins can log in. Use this for
    maintenance, payroll processing, or sensitive data updates."

  - Section 1: "Master Toggle"
    - Large card with toggle switch
    - Label: "Enable Access Schedule"
    - Description: "When ON, the schedule below is enforced. When OFF, all users can access at any time."
    - Toggle: ON / OFF (default OFF)
    - Status indicator: "Currently: Unrestricted" (green) or "Currently: {next window}" (amber)

  - Section 2: "Restricted Windows"
    - Description: "Define time periods when only admins can access the app."
    - List of windows (cards, vertical stack):
      Each window card:
      - Header: "Window {N}" + ON/OFF toggle for that window + "Delete" icon
      - Body:
        - "Start time" + "End time" (time pickers, 24-hour format, e.g. 23:00 to 07:00)
        - "Days" selector: Mon-Sun checkboxes (default: all 7)
        - "Applies to roles" multi-select: Project Manager, Accountant (Admin always allowed)
        - "Note" input (optional, internal)
        - Created by + Created at (small muted)
      - "Add Window" button below the list
    - Empty state: centered icon + "No restricted windows defined. All users can access at any time."

  - Section 3: "Current Status"
    - Live indicator:
      - Green dot + "Open Access" if currently outside any window
      - Red dot + "Restricted: Only admins" if currently inside a window
      - Shows current time + next window change
    - Mini timeline (24-hour): horizontal bar showing today's windows highlighted in red

  - Section 4: "Notifications"
    - Checkbox: "Notify users 15 minutes before a restricted window starts"
    - Checkbox: "Notify admin when a user is blocked from logging in"

  - Section 5: "Audit Log"
    - Toggle: "Log all access attempts during restricted windows"
    - Table: Timestamp, User, Role, Action (Login attempt / Settings access), Result (Allowed / Blocked), IP address
    - "Export log" button

  - Save button (bottom-right): "Save Schedule"
    - On click: PUT /settings/access-schedule → success toast

Data:
  GET /settings/access-schedule → { enabled, windows: [{ windowId, startTime, endTime, days: [0-6], appliesTo: ["project_manager","accountant"], note, createdBy, createdAt, isActive }], notifyBefore, logAttempts }
  PUT /settings/access-schedule → update above

=================================================================
[14i] Other Settings Sub-pages (Devices, Sessions, Reports, Privacy, About)
=================================================================
Devices, Sessions: unchanged from previous spec.
Reports Settings: default report format (Excel/PDF/CSV), default date range, email recipients.
Data & Privacy: data export request, account deletion (with confirm modal), cookie preferences.
About: app version, build number, terms of service link, privacy policy link, support contact.

=================================================================
VISUAL REFERENCE: WINDOWS 11 SETTINGS CARD PATTERN
=================================================================
Each left-pane item is structured as:
┌─────────────────────────────────────┐
│ [icon] Title                        │  ← 60-72px tall
│        Subtitle (optional, muted)   │     12px padding-x
└─────────────────────────────────────┘

Active state:
- Background: #f1f5f9
- Left border: 3px solid #002263
- Icon: #002263
- Title: #002263, semibold

Hover state (non-active):
- Background: #f8fafc
- No left border

Default state:
- Background: transparent
- Icon: #64748b
- Title: #0f172a, medium

=================================================================
SETTINGS LEFT PANE COMPONENT (for 00-components.html)
=================================================================
Build this as a reusable component in 00-components.html.
Props:
- items: [{ id, icon (svg path), title, subtitle, route, badge? }]
- activeId: string
- groupHeaders: [{ label, items: [...] }]

Onclick of item: navigate to route, set activeId.
Onclick of search: filter items by title (case-insensitive).

=================================================================
UPDATED DELIVERABLES LIST
=================================================================
Replace 14-settings.html with these files:
  14-settings.html                    — Settings shell with left pane (Windows 11 style), default route /settings/account
  14a-account.html                    — Account sub-page
  14b-notifications.html              — Notifications sub-page
  14c-appearance.html                 — Appearance (Theme settings) sub-page
  14d-roles.html                      — Roles and Employees sub-page
  14e-sites.html                      — Sites Directory sub-page
  14f-supervisors.html                — Supervisors Directory sub-page
  14g-approvals.html                  — Approval Rules sub-page
  14h-access-schedule.html            — Access Schedule (Untimed Management) sub-page
  14i-system.html                     — Devices, Sessions, Reports, Privacy, About (combined or separate)

(For simplicity, Stitch can produce these as one 14-settings.html file with
all sub-pages as separate <section> blocks, with the left pane driving
which section is visible via JS routing. This keeps the deliverable count
at 1 file but the content covers all sub-pages.)

Preferred: ONE 14-settings.html file with internal JS routing between
sub-pages. The URL hash determines which section is shown:
  #/account
  #/notifications
  #/appearance
  #/roles
  #/sites
  #/supervisors
  #/approvals
  #/access-schedule
  #/devices
  #/sessions
  #/reports
  #/privacy
  #/about

The sidebar links update the hash and the right pane re-renders.

=================================================================
END OF SETTINGS RESTRUCTURE
=================================================================
