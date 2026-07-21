import { Router, Request, Response, NextFunction } from "express";
import { requireAuth } from "../middleware/auth.js";
import * as companyProfileService from "../services/company-profile.service.js";

const router = Router();
router.use(requireAuth);

router.get("/company-profile", async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const profile = await companyProfileService.getCompanyProfile();
    res.json(profile);
  } catch (err) {
    next(err);
  }
});

router.post("/company-profile", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name, address, state, gstin, bankName, accountNumber, ifsc, branch } = req.body;
    const profile = await companyProfileService.saveCompanyProfile({
      name,
      address,
      state,
      gstin,
      bankName,
      accountNumber,
      ifsc,
      branch,
    });
    res.json({ success: true, profile });
  } catch (err) {
    next(err);
  }
});

export default router;
