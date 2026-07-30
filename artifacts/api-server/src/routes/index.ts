import { Router, type IRouter } from "express";
import healthRouter from "./health";
import partnersRouter from "./partners";
import dashboardRouter from "./dashboard";
import backupRouter from "./backup";
import investmentsRouter from "./investments";

const router: IRouter = Router();

router.use(healthRouter);
router.use(partnersRouter);
router.use(dashboardRouter);
router.use(backupRouter);
router.use(investmentsRouter);

export default router;
