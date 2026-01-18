// api/messages/index.js
import express from "express";
import authMiddleware from "../middleware/authMiddleware.js";

import send from "./send.js";
import thread from "./thread.js";
import markRead from "./mark-read.js";
import markDelivered from "./markDelivered.js";
import hide from "./hide.js";
import restore from "./restore.js";
import deleteMsg from "./delete.js";
import hidden from "./hidden.js";
import react from "./react.js";
import edit from "./edit.js";
import audio from "./audio.js";
import upload from "./upload.js";

const router = express.Router();

router.use(authMiddleware);

router.post("/send", send);
router.get("/thread/:id", thread);
router.post("/mark-read", markRead);
router.post("/mark-delivered", markDelivered);
router.post("/hide", hide);
router.post("/restore", restore);
router.post("/delete", deleteMsg);
router.get("/hidden", hidden);
router.post("/react", react);
router.post("/edit", edit);
router.post("/audio", audio);
router.post("/upload", upload);

export default router;

