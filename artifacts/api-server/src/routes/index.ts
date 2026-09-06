import { Router, type IRouter } from "express";
import healthRouter from "./health";
import signupRouter from "./signup";
import waitlistRouter from "./waitlist";
import studyRouter from "./study";
import documentsRouter from "./documents";
import eventsRouter from "./events";
import achievementsRouter from "./achievements";
import institutionsRouter from "./institutions";
import accountRouter from "./account";
import studyMaterialsRouter from "./study-materials";

const router: IRouter = Router();

router.use(healthRouter);
router.use(signupRouter);
router.use(waitlistRouter);
router.use(studyRouter);
router.use(documentsRouter);
router.use(eventsRouter);
router.use(achievementsRouter);
router.use(institutionsRouter);
router.use(accountRouter);
router.use(studyMaterialsRouter);

export default router;
