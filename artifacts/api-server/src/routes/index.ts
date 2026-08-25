import { Router, type IRouter } from "express";
import healthRouter from "./health";
import studyRouter from "./study";
import documentsRouter from "./documents";

const router: IRouter = Router();

router.use(healthRouter);
router.use(studyRouter);
router.use(documentsRouter);

export default router;
