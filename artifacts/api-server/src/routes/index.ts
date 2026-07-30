import { Router, type IRouter } from "express";
import healthRouter from "./health";
import partnersRouter from "./partners";
import dashboardRouter from "./dashboard";
import backupRouter from "./backup";
import investmentsRouter from "./investments";
import directExpensesRouter from "./direct-expenses";
import pettyCashGivenRouter from "./petty-cash-given";
import accountantExpensesRouter from "./accountant-expenses";
import jointIncomesRouter from "./joint-incomes";

const router: IRouter = Router();

router.use(healthRouter);
router.use(partnersRouter);
router.use(dashboardRouter);
router.use(backupRouter);
router.use(investmentsRouter);
router.use(directExpensesRouter);
router.use(pettyCashGivenRouter);
router.use(accountantExpensesRouter);
router.use(jointIncomesRouter);

export default router;
