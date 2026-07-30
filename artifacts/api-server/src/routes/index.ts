import { Router, type IRouter } from "express";
import healthRouter from "./health";
import partnersRouter from "./partners";
import dashboardRouter from "./dashboard";
import backupRouter from "./backup";

const router: IRouter = Router();

router.use(healthRouter);
router.use(partnersRouter);
router.use(dashboardRouter);
router.use(backupRouter);

export default router;
