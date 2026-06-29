$ErrorActionPreference = "Continue"
$baseUrl = "http://localhost:4000"

Write-Host "`n========== AJUI BACKEND - ALL PHASE MANUAL TESTS ==========`n" -ForegroundColor Cyan

# ========== PHASE 1: AUTH ==========
Write-Host "--- PHASE 1: AUTH ---" -ForegroundColor Yellow

# 1. Health
Write-Host "`n[1] Health check:"
$r = Invoke-WebRequest -Uri "$baseUrl/health" -UseBasicParsing
Write-Host "  Status: $($r.StatusCode) - $($r.Content)"

# 2. Login
Write-Host "`n[2] Login (admin):"
$loginBody = '{"phone":"+919999999999","password":"TestPass123"}'
$loginResp = Invoke-WebRequest -Uri "$baseUrl/api/auth/login" -Method POST -ContentType "application/json" -Body $loginBody -UseBasicParsing
Write-Host "  Status: $($loginResp.StatusCode)"
$loginData = $loginResp.Content | ConvertFrom-Json
$token = $loginData.accessToken
Write-Host "  Token (truncated): $($token.Substring(0,40))..."
Write-Host "  User: $($loginData.user.name) [$($loginData.user.role)]"

# 3. Auth me
Write-Host "`n[3] Get current user:"
$me = Invoke-WebRequest -Uri "$baseUrl/api/auth/me" -Headers @{Authorization="Bearer $token"} -UseBasicParsing
Write-Host "  Status: $($me.StatusCode) - $(($me.Content | ConvertFrom-Json).user.name)"

# 4. Forgot password
Write-Host "`n[4] Forgot password:"
$fp = Invoke-WebRequest -Uri "$baseUrl/api/auth/forgot-password" -Method POST -ContentType "application/json" -Body '{"email":"admin@test.com"}' -UseBasicParsing
Write-Host "  Status: $($fp.StatusCode) - $($fp.Content)"

# 5. Create QR invite
Write-Host "`n[5] Create QR supervisor invite:"
$qr = Invoke-WebRequest -Uri "$baseUrl/api/admin/invites/supervisor" -Method POST -ContentType "application/json" -Headers @{Authorization="Bearer $token"} -Body '{"expiryHours":24}' -UseBasicParsing
Write-Host "  Status: $($qr.StatusCode)"
$qrData = $qr.Content | ConvertFrom-Json
Write-Host "  Token: $($qrData.token.Substring(0,30))..."
Write-Host "  QR URL: $($qrData.qrUrl)"
Write-Host "  QR DataURL length: $($qrData.qrDataUrl.Length) chars"

# ========== PHASE 2: CORE ENTITIES ==========
Write-Host "`n--- PHASE 2: CORE ENTITIES ---" -ForegroundColor Yellow

# 6. Create client
Write-Host "`n[6] Create client:"
$clientBody = '{"name":"Meenakshi Raman","mobile":"+919840211880","address":"Velachery","gstNumber":"33ABC123"}'
$client = Invoke-WebRequest -Uri "$baseUrl/api/clients" -Method POST -ContentType "application/json" -Headers @{Authorization="Bearer $token"} -Body $clientBody -UseBasicParsing
Write-Host "  Status: $($client.StatusCode)"
$clientData = $client.Content | ConvertFrom-Json
$clientId = $clientData.client._id
Write-Host "  Client ID: $($clientData.client.clientId) ($($clientData.client.name))"

# 7. List clients
Write-Host "`n[7] List clients:"
$list = Invoke-WebRequest -Uri "$baseUrl/api/clients" -Headers @{Authorization="Bearer $token"} -UseBasicParsing
$listData = $list.Content | ConvertFrom-Json
Write-Host "  Status: $($list.StatusCode) - Total: $($listData.total) clients"

# 8. Create site
Write-Host "`n[8] Create site:"
$site = Invoke-WebRequest -Uri "$baseUrl/api/sites" -Method POST -ContentType "application/json" -Headers @{Authorization="Bearer $token"} -Body '{"name":"Area 1","startDate":"2026-05-08"}' -UseBasicParsing
$siteData = $site.Content | ConvertFrom-Json
$siteId = $siteData.site._id
Write-Host "  Status: $($site.StatusCode) - Site: $($siteData.site.siteId)"

# 9. Create project
Write-Host "`n[9] Create project:"
$projBody = "{`"name`":`"Green Nest Villas`",`"clientId`":`"$clientId`",`"mobile`":`"+919840211880`",`"address`":`"Velachery`",`"supervisor`":`"R. Karthik`",`"siteIds`":[`"$siteId`"],`"startDate`":`"2026-05-08`",`"totalValue`":5000000,`"advanceAmount`":1000000}"
$proj = Invoke-WebRequest -Uri "$baseUrl/api/projects" -Method POST -ContentType "application/json" -Headers @{Authorization="Bearer $token"} -Body $projBody -UseBasicParsing
$projData = $proj.Content | ConvertFrom-Json
$projectId = $projData.project._id
Write-Host "  Status: $($proj.StatusCode) - Project: $($projData.project.projectId)"
Write-Host "  Pending balance: $($projData.project.pendingBalance)"

# 10. Project ledger
Write-Host "`n[10] Project ledger:"
$ledger = Invoke-WebRequest -Uri "$baseUrl/api/projects/$projectId/ledger" -Headers @{Authorization="Bearer $token"} -UseBasicParsing
$ledgerData = ($ledger.Content | ConvertFrom-Json).ledger
Write-Host "  Status: $($ledger.StatusCode)"
Write-Host "  TotalValue: $($ledgerData.totalValue) | PendingBalance: $($ledgerData.pendingBalance)"

# 11. Client summary
Write-Host "`n[11] Client summary:"
$summary = Invoke-WebRequest -Uri "$baseUrl/api/clients/$clientId/summary" -Headers @{Authorization="Bearer $token"} -UseBasicParsing
$sumData = $summary.Content | ConvertFrom-Json
Write-Host "  Status: $($summary.StatusCode) - Projects: $($sumData.projectCount)"

# 12. Create supervisor
Write-Host "`n[12] Create supervisor:"
$supBody = '{"name":"R. Karthik","phone":"+919840011880","email":"karthik@agbuilders.com","cashLimit":50000,"approvalAuthority":25000}'
$sup = Invoke-WebRequest -Uri "$baseUrl/api/supervisors" -Method POST -ContentType "application/json" -Headers @{Authorization="Bearer $token"} -Body $supBody -UseBasicParsing
Write-Host "  Status: $($sup.StatusCode)"
$supData = $sup.Content | ConvertFrom-Json
Write-Host "  Supervisor: $($supData.supervisor.supervisorId)"

# 13. Custom field
Write-Host "`n[13] Custom field:"
$cf = Invoke-WebRequest -Uri "$baseUrl/api/custom-fields" -Method POST -ContentType "application/json" -Headers @{Authorization="Bearer $token"} -Body "{`"entityType`":`"clients`",`"entityId`":`"$clientId`",`"key`":`"pan_number`",`"label`":`"PAN`",`"value`":`"ABCDE1234F`",`"fieldType`":`"text`",`"order`":0}" -UseBasicParsing
Write-Host "  Status: $($cf.StatusCode)"

# ========== PHASE 3: FINANCIAL ==========
Write-Host "`n--- PHASE 3: FINANCIAL + APPROVALS ---" -ForegroundColor Yellow

# 14. Create vendor
Write-Host "`n[14] Create vendor:"
$v = Invoke-WebRequest -Uri "$baseUrl/api/vendors" -Method POST -ContentType "application/json" -Headers @{Authorization="Bearer $token"} -Body '{"name":"Sri Devi Traders","materialType":"Cement","phone":"+919841022001","address":"Velachery"}' -UseBasicParsing
$vData = $v.Content | ConvertFrom-Json
$vendorId = $vData.vendor._id
Write-Host "  Status: $($v.StatusCode) - Vendor: $($vData.vendor.vendorId)"

# 15. Create material
Write-Host "`n[15] Create material (auto-creates approval):"
$matBody = "{`"projectId`":`"$projectId`",`"site`":`"Area 1`",`"name`":`"Cement`",`"unit`":`"Bag`",`"requestedQuantity`":100,`"approvedQuantity`":100,`"purchasedQuantity`":100,`"consumedQuantity`":50,`"vendor`":`"Sri Devi`",`"vendorId`":`"$vendorId`",`"poNumber`":`"PO-1`",`"requestDate`":`"2026-06-01`"}"
$mat = Invoke-WebRequest -Uri "$baseUrl/api/materials" -Method POST -ContentType "application/json" -Headers @{Authorization="Bearer $token"} -Body $matBody -UseBasicParsing
$matData = $mat.Content | ConvertFrom-Json
Write-Host "  Status: $($mat.StatusCode) - Material: $($matData.material.materialId), remaining: $($matData.material.remainingStock)"

# 16. Create labour with dynamic types
Write-Host "`n[16] Create labour (dynamic laborTypes):"
$labBody = "{`"projectId`":`"$projectId`",`"site`":`"Area 1`",`"partyName`":`"Velu Mason`",`"category`":`"Masonry`",`"attendanceDate`":`"2026-06-08`",`"presentCount`":5,`"dailyWage`":950,`"laborTypes`":[{`"name`":`"Mason`",`"dailyWage`":1100,`"staffCount`":3},{`"name`":`"Helper`",`"dailyWage`":700,`"staffCount`":2}]}"
$lab = Invoke-WebRequest -Uri "$baseUrl/api/labour" -Method POST -ContentType "application/json" -Headers @{Authorization="Bearer $token"} -Body $labBody -UseBasicParsing
$labData = $lab.Content | ConvertFrom-Json
Write-Host "  Status: $($lab.StatusCode) - Labour: $($labData.labour.labourId), types: $($labData.labour.laborTypes.Count)"

# 17. Create site expenses (running balance)
Write-Host "`n[17] Site expenses (running balance):"
$e1 = Invoke-WebRequest -Uri "$baseUrl/api/expenses" -Method POST -ContentType "application/json" -Headers @{Authorization="Bearer $token"} -Body "{`"type`":`"site`",`"projectId`":`"$projectId`",`"site`":`"Area 1`",`"amount`":5000,`"date`":`"2026-06-01`",`"description`":`"Petrol`"}" -UseBasicParsing
Write-Host "  Expense 1 balance: $((($e1.Content | ConvertFrom-Json).expense.runningBalance))"

$e2 = Invoke-WebRequest -Uri "$baseUrl/api/expenses" -Method POST -ContentType "application/json" -Headers @{Authorization="Bearer $token"} -Body "{`"type`":`"site`",`"projectId`":`"$projectId`",`"site`":`"Area 1`",`"amount`":3000,`"date`":`"2026-06-02`",`"description`":`"Water`"}" -UseBasicParsing
Write-Host "  Expense 2 balance: $((($e2.Content | ConvertFrom-Json).expense.runningBalance))"

# 18. General expense
Write-Host "`n[18] General expense:"
$g = Invoke-WebRequest -Uri "$baseUrl/api/expenses" -Method POST -ContentType "application/json" -Headers @{Authorization="Bearer $token"} -Body '{"type":"general","department":"Office","category":"Stationery","amountPaidBy":"Anitha","amount":1500,"date":"2026-06-03","description":"Ink"}' -UseBasicParsing
Write-Host "  Status: $($g.StatusCode)"

# 19. Payment
Write-Host "`n[19] Payment:"
$p = Invoke-WebRequest -Uri "$baseUrl/api/payments" -Method POST -ContentType "application/json" -Headers @{Authorization="Bearer $token"} -Body "{`"projectId`":`"$projectId`",`"clientId`":`"$clientId`",`"date`":`"2026-06-05`",`"amount`":1500000,`"mode`":`"NEFT`",`"receiptNumber`":`"R-1`",`"transactionReference`":`"U-1`",`"collectedBy`":`"Anitha`"}" -UseBasicParsing
$pData = $p.Content | ConvertFrom-Json
Write-Host "  Status: $($p.StatusCode) - Payment: $($pData.payment.paymentId)"

# 20. Subcontractor
Write-Host "`n[20] Subcontractor:"
$s = Invoke-WebRequest -Uri "$baseUrl/api/subcontractors" -Method POST -ContentType "application/json" -Headers @{Authorization="Bearer $token"} -Body "{`"projectId`":`"$projectId`",`"site`":`"Area 1`",`"subcontractorName`":`"Selvam`",`"workPackage`":`"Masonry`",`"contractValue`":780000,`"advancePaid`":125000,`"startDate`":`"2026-05-08`",`"dueDate`":`"2026-07-15`",`"supervisor`":`"K`"}" -UseBasicParsing
$sData = $s.Content | ConvertFrom-Json
Write-Host "  Status: $($s.StatusCode) - Sub: $($sData.subcontractor.subcontractId), balance: $($sData.subcontractor.balance)"

# 21. List pending approvals
Write-Host "`n[21] Pending approvals:"
$a = Invoke-WebRequest -Uri "$baseUrl/api/approvals" -Headers @{Authorization="Bearer $token"} -UseBasicParsing
$aData = $a.Content | ConvertFrom-Json
Write-Host "  Status: $($a.StatusCode) - Pending: $($aData.items.Count)"
$aData.items | ForEach-Object { Write-Host "    $($_.approvalId) | $($_.type) | $($_.title)" }

# 22. Approve all
Write-Host "`n[22] Approving all pending..."
foreach ($appr in $aData.items) {
  $resp = Invoke-WebRequest -Uri "$baseUrl/api/approvals/$($appr.approvalId)/approve" -Method PUT -Headers @{Authorization="Bearer $token"} -UseBasicParsing
  $status = ($resp.Content | ConvertFrom-Json).approval.status
  Write-Host "    $($appr.approvalId): $status"
}

# 23. Project ledger AFTER approvals
Write-Host "`n[23] Project ledger (after approvals):"
$ledger = Invoke-WebRequest -Uri "$baseUrl/api/projects/$projectId/ledger" -Headers @{Authorization="Bearer $token"} -UseBasicParsing
$lData = ($ledger.Content | ConvertFrom-Json).ledger
Write-Host "  receivedAmount: $($lData.receivedAmount)"
Write-Host "  materialSpend: $($lData.materialSpend)"
Write-Host "  labourPayable: $($lData.labourPayable)"
Write-Host "  pendingBalance: $($lData.pendingBalance)"

# 24. Expense ledger
Write-Host "`n[24] Expense ledger (project+site):"
$eL = Invoke-WebRequest -Uri "$baseUrl/api/expenses/ledger/$projectId/Area%201" -Headers @{Authorization="Bearer $token"} -UseBasicParsing
$eLedger = ($eL.Content | ConvertFrom-Json).ledger
Write-Host "  Entries: $($eLedger.Count)"
$eLedger | ForEach-Object { Write-Host "    $($_.expenseId) | $($_.date) | $($_.description) | bal=$($_.runningBalance)" }

Write-Host "`n========== ALL TESTS COMPLETE ==========`n" -ForegroundColor Green

notepad test-manual.ps1
