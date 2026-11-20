import { Router, type Request, type Response } from "express";
// @ts-ignore
import handler from "../../../../api/line-webhook.js";

const router = Router();

router.all("/line-webhook", async (req: Request, res: Response) => {
  await handler(req, res);
});

export default router;
