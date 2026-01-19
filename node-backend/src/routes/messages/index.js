import express from "express";
import authMiddleware from "../../middleware/auth.js";
import listHandler from "./list.js";
import threadHandler from "./thread.js";
import sendHandler from "./send.js";
import audioHandler from "./audio.js";

const router = express.Router();

router.get("/list", authMiddleware, listHandler);
router.get("/thread/:contactId", authMiddleware, threadHandler);
router.post("/send", authMiddleware, sendHandler);
router.post("/audio", authMiddleware, audioHandler);

export default router;
