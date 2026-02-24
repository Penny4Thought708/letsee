import fs from "fs";
import express from "express";
const router = express.Router();

router.get("/", (req, res) => {
  const projects = JSON.parse(fs.readFileSync("data/projects.json", "utf8"));
  res.json(projects);
});

export default router;
