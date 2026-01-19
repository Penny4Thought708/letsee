import express from "express";
import authMiddleware from "../../middleware/auth.js";

import listHandler from "./list.js";
import threadHandler from "./thread.js";
import sendHandler from "./send.js";
import audioHandler from "./audio.js";
import markReadHandler from "./markRead.js";   // ✅ ADD THIS

const router = express.Router();

router.get("/list", authMiddleware, listHandler);
router.get("/thread/:contactId", authMiddleware, threadHandler);
router.post("/send", authMiddleware, sendHandler);
router.post("/audio", authMiddleware, audioHandler);
router.post("/mark-read", authMiddleware, markReadHandler); // ✅ ADD THIS

export default router;
