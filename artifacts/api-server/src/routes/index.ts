import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import guardianRouter from "./guardian";
import ocorrenciasRouter from "./ocorrencias";
import schoolRouter from "./school";
import adminRouter from "./admin";
import reconciliationRouter, { runReconciliationMigration } from "./reconciliation";
import paymentsRouter from "./payments";
import smsRouter, { runSMSMigration } from "./sms";
import reportsRouter, { runReportsMigration } from "./reports";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(guardianRouter);
router.use(ocorrenciasRouter);
router.use(schoolRouter);
router.use(adminRouter);
router.use(reconciliationRouter);
router.use(paymentsRouter);
router.use(smsRouter);
router.use(reportsRouter);

/* Run DB migrations (idempotent) */
runReconciliationMigration().catch(err =>
  console.error("[reconciliation migration]", err)
);
runSMSMigration().catch(err =>
  console.error("[sms migration]", err)
);
runReportsMigration().catch(err =>
  console.error("[reports migration]", err)
);

export default router;
