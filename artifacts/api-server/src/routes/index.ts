import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import guardianRouter from "./guardian";
import ocorrenciasRouter from "./ocorrencias";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(guardianRouter);
router.use(ocorrenciasRouter);

export default router;
