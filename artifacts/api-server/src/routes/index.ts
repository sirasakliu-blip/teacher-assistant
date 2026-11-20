import { Router, type IRouter } from "express";
import healthRouter from "./health";
import lineWebhookRouter from "./line-webhook";

const router: IRouter = Router();

router.use(healthRouter);
router.use(lineWebhookRouter);

export default router;
