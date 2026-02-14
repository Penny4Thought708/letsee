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

    // Return EXACTLY what Xirsys provides
    const iceServers = Array.isArray(data?.v?.iceServers)
      ? data.v.iceServers
      : [];

    return res.json({ iceServers });
  } catch (err) {
    console.error("[ICE] Xirsys error:", err);
    return res.json({ iceServers: [] });
  }
});



    // 🔥 HARD FILTER: only TURN/TLS on 443 with TCP
    iceServers = iceServers
      .map((s) => ({
        ...s,
        urls: s.urls.filter(
          (u) =>
            typeof u === "string" &&
            u.startsWith("turns:") &&
            u.includes(":443") &&
            u.includes("transport=tcp")
        ),
      }))
      .filter((s) => s.urls.length > 0);

    // Guaranteed extra TURN on 443/tcp (global)
    const guaranteedRelay = {
      urls: ["turns:us-turn3.xirsys.com:443?transport=tcp"],
      username:
        "pNNsSw9RUFU1xAmcGCS_jLnWqdxLgtmfu842JQSyJCHTIgqCXERA2MZWWQES9H9VAAAAAGl7xz1Ub21teVlhdHRz",
      credential: "a4e8a85e-fd53-11f0-b4fa-0242ac140004",
    };

    const hasGuaranteed = iceServers.some((s) =>
      s.urls.some((u) => u.includes("us-turn3.xirsys.com:443"))
    );

    if (!hasGuaranteed) {
      iceServers.push(guaranteedRelay);
    }

    // 🔥 NO STUN. NO UDP. ONLY TURN/TCP/TLS/443.
    return res.json({ iceServers });
  } catch (err) {
    console.error("[ICE] Xirsys error:", err);

    // 🔥 Clean fallback: TURN 443/tcp only, still no STUN
    return res.json({
      iceServers: [
        {
          urls: [
            "turns:us-turn3.xirsys.com:443?transport=tcp",
            "turns:us-turn3.xirsys.com:5349?transport=tcp",
          ],
          username:
            "pNNsSw9RUFU1xAmcGCS_jLnWqdxLgtmfu842JQSyJCHTIgqCXERA2MZWWQES9H9VAAAAAGl7xz1Ub21teVlhdHRz",
          credential: "a4e8a85e-fd53-11f0-b4fa-0242ac140004",
        },
      ],
    });
  }
});

export { router };
export default router;





