import express from "express";
import fetch from "node-fetch";

const router = express.Router();

/**
 * Simple in‑memory cache for ICE servers
 */
let cachedIce = null;
let cachedAt = 0;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

function getCachedIce() {
  if (!cachedIce) return null;
  const age = Date.now() - cachedAt;
  if (age > CACHE_TTL_MS) {
    cachedIce = null;
    return null;
  }
  return cachedIce;
}

function setCachedIce(iceServers) {
  cachedIce = iceServers;
  cachedAt = Date.now();
}

/**
 * Optional backup STUN / TURN config
 * (fill in TURN creds if/when you have a second provider)
 */
const FALLBACK_STUN_ONLY = [
  { urls: "stun:stun.l.google.com:19302" },
];

const FALLBACK_WITH_TURN = [
  { urls: "stun:stun.l.google.com:19302" },
  // Example TURN placeholder – replace with your own if desired:
  // {
  //   urls: ["turn:your-turn.example.com:3478?transport=udp",
  //          "turns:your-turn.example.com:5349?transport=tcp"],
  //   username: "your-username",
  //   credential: "your-credential",
  // },
];

/**
 * Prefer mobile‑friendly TURN 443/tcp, but DO NOT delete others.
 * We just reorder so 443/tcp is first in each server.urls array.
 */
function preferMobileFriendlyOrder(iceServers) {
  return iceServers.map((s) => {
    const urls = Array.isArray(s.urls) ? s.urls.slice() : [s.urls];

    const preferred = [];
    const others = [];

    urls.forEach((u) => {
      if (
        typeof u === "string" &&
        u.startsWith("turn") &&
        u.includes(":443") &&
        u.includes("transport=tcp")
      ) {
        preferred.push(u);
      } else {
        others.push(u);
      }
    });

    return {
      ...s,
      urls: [...preferred, ...others],
    };
  });
}

router.get("/get-ice", async (req, res) => {
  try {
    // 1) Serve from cache if fresh
    const cached = getCachedIce();
    if (cached) {
      return res.json({ iceServers: cached, fromCache: true });
    }

    // 2) Fetch from Xirsys
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

    if (!response.ok) {
      console.error("[ICE] Xirsys HTTP error:", response.status, await response.text());
      // Hard fallback: STUN + optional backup TURN
      const fallback = FALLBACK_WITH_TURN;
      setCachedIce(fallback);
      return res.json({ iceServers: fallback, fallback: "xirsys-http" });
    }

    const data = await response.json();

    let iceServers = Array.isArray(data?.v?.iceServers)
      ? data.v.iceServers
      : [];

    // 3) Normalize urls to arrays
    iceServers = iceServers.map((s) => {
      const urls = Array.isArray(s.urls) ? s.urls : [s.urls];
      return { ...s, urls };
    });

    // 4) Prefer mobile‑friendly TURN 443/tcp, but keep everything
    iceServers = preferMobileFriendlyOrder(iceServers);

    // 5) Cache and return
    setCachedIce(iceServers);
    return res.json({ iceServers, fromCache: false });
  } catch (err) {
    console.error("[ICE] Xirsys error:", err);

    // 6) On error, use fallback STUN / TURN
    const fallback = FALLBACK_WITH_TURN;
    setCachedIce(fallback);
    return res.json({ iceServers: fallback, fallback: "exception" });
  }
});

export { router };
export default router;



