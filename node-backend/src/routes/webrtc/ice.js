import express from "express";
import fetch from "node-fetch";

const router = express.Router();

router.get("/get-ice", async (req, res) => {
  try {
    const body = JSON.stringify({ format: "urls" });

    const response = await fetch("https://global.xirsys.net/_turn/MyFirstApp", {
      method: "PUT",
      headers: {
        "Authorization":
          "Basic " +
          Buffer.from("bobbywatts:9abbe54c-09ad-11f1-aa18-0242ac150002").toString("base64"),
        "Content-Type": "application/json",
      },
      body,
    });

    const data = await response.json();

    const iceServers = Array.isArray(data?.v?.iceServers)
      ? data.v.iceServers
      : [];

    return res.json({ iceServers });
  } catch (err) {
    console.error("[ICE] Xirsys error:", err);
    return res.json({ iceServers: [] });
  }
});

export { router };
export default router;
;





