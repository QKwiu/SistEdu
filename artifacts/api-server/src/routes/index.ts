import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import guardianRouter from "./guardian";
import ocorrenciasRouter from "./ocorrencias";
import schoolRouter from "./school";
import adminRouter from "./admin";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(guardianRouter);
router.use(ocorrenciasRouter);
router.use(schoolRouter);
router.use(adminRouter);

export default router;
