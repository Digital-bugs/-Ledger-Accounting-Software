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
import excelImportRouter from "./excel-import";
import finalSummaryRouter from "./final-summary";
import reportsRouter from "./reports";

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
router.use(excelImportRouter);
router.use(finalSummaryRouter);
router.use(reportsRouter);

export default router;
