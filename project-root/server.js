import express from "express";
import path from "path";
import generateGuide from "./api/generate-guide.js";
import getGuide from "./api/get-guide.js";
import search from "./api/search.js";

const app = express();
app.use(express.json());
app.use(express.static("public"));

app.use("/api/generate-guide", generateGuide);
app.use("/api/guide", getGuide);
app.use("/api/search", search);

app.listen(3000, () => console.log("Server running on port 3000"));
