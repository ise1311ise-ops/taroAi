import "dotenv/config";
import crypto from "crypto";
import express from "express";

const app = express();
app.use(express.json({ limit: "1mb" }));

const PORT = process.env.PORT || 8080;
const WEB_ORIGIN = process.env.WEB_ORIGIN || "*";

// CORS: для GitHub Pages укажи WEB_ORIGIN=https://USERNAME.github.io
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", WEB_ORIGIN === "*" ? "*" : WEB_ORIGIN);
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});

function verifyTelegramInitData(initData, botToken) {
  if (!initData || !botToken) return false;

  const params = new URLSearchParams(initData);
  const hash = params.get("hash");
  if (!hash) return false;

  params.delete("hash");

  const pairs = [];
  for (const [k, v] of params.entries()) pairs.push([k, v]);
  pairs.sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  const dataCheckString = pairs.map(([k, v]) => `${k}=${v}`).join("\n");

  const secretKey = crypto.createHmac("sha256", "WebAppData").update(botToken).digest();
  const calcHash = crypto.createHmac("sha256", secretKey).update(dataCheckString).digest("hex");

  try {
    return crypto.timingSafeEqual(Buffer.from(calcHash), Buffer.from(hash));
  } catch {
    return false;
  }
}

function safeText(s, max = 900) {
  if (typeof s !== "string") return "";
  return s.replace(/\s+/g, " ").trim().slice(0, max);
}

// простой лимит на пользователя (память процесса)
const userWindow = new Map();
function allowUser(userId, limit = 12, windowMs = 60_000) {
  const now = Date.now();
  const cur = userWindow.get(userId) || { start: now, count: 0 };
  if (now - cur.start > windowMs) {
    cur.start = now;
    cur.count = 0;
  }
  cur.count += 1;
  userWindow.set(userId, cur);
  return cur.count <= limit;
}

function buildPrompt({ question, spreadName, cards, style }) {
  const cardLines = cards.map(c => {
    const rev = c.reversed ? " (перевёрнутая)" : "";
    const pos = c.position ? ` — позиция: ${c.position}` : "";
    const meta = c.meta ? ` — ключи: ${c.meta}` : "";
    return `- ${c.name}${rev}${pos}${meta}`;
  }).join("\n");

  return `
Ты — внимательный таролог-консультант. Отвечай по-русски.
Это развлекательная и саморефлексивная трактовка. Не давай медицинских/юридических инструкций и не обещай 100% гарантии.
Тон: ${style || "тёплый, конкретный, без мистического давления"}.

Вопрос пользователя: "${question}"
Расклад: ${spreadName}

Карты:
${cardLines}

Сделай ответ в формате:
1) Итог (1-2 предложения)
2) Трактовка по позициям (по пунктам)
3) Что делать дальше: 3 конкретных шага на 24–72 часа
4) На что обратить внимание (риски/слепые зоны) — 2 пункта
5) Вопрос для саморефлексии — 1 штука
`.trim();
}

app.get("/health", (_, res) => res.json({ ok: true }));

app.post("/api/tarot/reading", async (req, res) => {
  try {
    const { initData, question, spreadName, cards, style } = req.body || {};

    // Разрешаем тестировать и вне Telegram: initData может быть пустым
    const inTelegram = !!initData;
    if (inTelegram) {
      const ok = verifyTelegramInitData(initData, process.env.TELEGRAM_BOT_TOKEN);
      if (!ok) return res.status(401).json({ error: "Invalid Telegram initData" });
    }

    let userId = "web";
    if (inTelegram) {
      const p = new URLSearchParams(initData);
      const userJson = p.get("user");
      const user = userJson ? JSON.parse(userJson) : null;
      if (user?.id) userId = String(user.id);
    }
    if (!allowUser(userId)) return res.status(429).json({ error: "Rate limit" });

    const q = safeText(question, 320);
    const spread = safeText(spreadName || "Расклад", 80);
    const list = Array.isArray(cards) ? cards.slice(0, 12) : [];
    if (!q || list.length === 0) return res.status(400).json({ error: "Bad input" });

    const prompt = buildPrompt({
      question: q,
      spreadName: spread,
      style: safeText(style || "", 120),
      cards: list.map(c => ({
        name: safeText(c?.name, 80),
        position: safeText(c?.position, 40),
        reversed: !!c?.reversed,
        meta: safeText(c?.meta || "", 140)
      }))
    });

    const r = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "gpt-4.1-mini",
        input: prompt,
        temperature: 0.75
      })
    });

    if (!r.ok) {
      const errText = await r.text();
      return res.status(502).json({ error: "AI error", details: errText.slice(0, 600) });
    }

    const data = await r.json();
    const text =
      data?.output_text ||
      data?.output?.[0]?.content?.[0]?.text ||
      "Не удалось сформировать ответ.";

    return res.json({ ok: true, text });
  } catch (e) {
    return res.status(500).json({ error: "Server error", details: String(e?.message || e) });
  }
});

app.listen(PORT, () => console.log("Server listening on", PORT));
