import { Router, type IRouter } from "express";
import { db } from "../lib/database";
import { ListPartnersResponse } from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/partners", (_req, res): void => {
  const rows = db
    .prepare(
      "SELECT id, name, share_percentage as sharePercentage FROM partners ORDER BY id"
    )
    .all();
  res.json(ListPartnersResponse.parse(rows));
});

export default router;
