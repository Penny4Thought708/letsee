import express from "express";
import authMiddleware from "../../middleware/auth.js";

import listHandler from "./list.js";
import saveHandler from "./save.js";
import deleteHandler from "./delete.js";
import listenedHandler from "./listened.js";   // ✅ THIS WAS MISSING

const router = express.Router();

router.get("/list", authMiddleware, listHandler);
router.post("/save", authMiddleware, saveHandler);
router.post("/delete", authMiddleware, deleteHandler);
router.post("/listened", authMiddleware, listenedHandler); // now valid

export default router;


