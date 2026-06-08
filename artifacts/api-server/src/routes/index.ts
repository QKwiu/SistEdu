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
import rbacRouter, { runRBACMigration } from "./rbac";
import staffPortalRouter from "./staff-portal";
import infantRouter, { runInfantMigration } from "./infant";
import portalRouter from "./portal";
import fcmRouter from "./fcm";
import directDebitRouter, { runDirectDebitMigration } from "./direct-debit";
import splitPayRouter, { runSplitPayMigration } from "./splitpay";
import backupRouter from "./backup";
import { runBackupMigration, startBackupScheduler } from "../services/backup.service";

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
router.use(rbacRouter);
router.use(staffPortalRouter);
router.use(infantRouter);
router.use(portalRouter);
router.use(fcmRouter);
router.use(directDebitRouter);
router.use(splitPayRouter);
router.use(backupRouter);

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
runRBACMigration().catch(err =>
  console.error("[rbac migration]", err)
);
runInfantMigration().catch(err =>
  console.error("[infant migration]", err)
);
runDirectDebitMigration().catch(err =>
  console.error("[direct-debit migration]", err)
);
runSplitPayMigration().catch(err =>
  console.error("[splitpay migration]", err)
);
runBackupMigration()
  .then(() => startBackupScheduler())
  .catch(err => console.error("[backup migration]", err));

export default router;
