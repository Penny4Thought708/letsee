import fs from "fs";
import path from "path";
import express from "express";

const router = express.Router();

router.get("/:slug", (req, res, next) => {
  try {
    const slug = req.params.slug;
    const filePath = path.join("public", "guides", `${slug}.html`);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: "Guide not found" });
    }

    const html = fs.readFileSync(filePath, "utf8");
    res.type("html").send(html);
  } catch (err) {
    next(err);
  }
});

export default router;
