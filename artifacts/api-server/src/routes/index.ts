import { Router, type IRouter } from "express";
import healthRouter from "./health";
import studyRouter from "./study";
import documentsRouter from "./documents";
import eventsRouter from "./events";
import achievementsRouter from "./achievements";

const router: IRouter = Router();

router.use(healthRouter);
router.use(studyRouter);
router.use(documentsRouter);
router.use(eventsRouter);
router.use(achievementsRouter);

export default router;
