import { Router, type IRouter } from "express";
import healthRouter from "./health";
import studyRouter from "./study";
import documentsRouter from "./documents";
import eventsRouter from "./events";
import achievementsRouter from "./achievements";
import institutionsRouter from "./institutions";
import accountRouter from "./account";

const router: IRouter = Router();

router.use(healthRouter);
router.use(studyRouter);
router.use(documentsRouter);
router.use(eventsRouter);
router.use(achievementsRouter);
router.use(institutionsRouter);
router.use(accountRouter);

export default router;
