// Netlify serverless function: /api/make_card
// Netlify makes the call to LM Studio. The browser never hits LM directly.

const LLM_SITE   = process.env.LLM_SITE;                 // e.g. https://your-public-lm-host:1234
const LLM_MODEL  = process.env.LLM_MODEL_ID;             // e.g. MXFP4
const LLM_PATH   = process.env.LLM_API_PATH || "/v1/chat/completions";

exports.handler = async (event) => {
  // CORS preflight
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type",
        "Access-Control-Allow-Methods": "POST, OPTIONS"
      },
      body: ""
    };
  }

  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      headers: cors(),
      body: JSON.stringify({ error: "Method Not Allowed" })
    };
  }

  if (!LLM_SITE) {
    return {
      statusCode: 500,
      headers: cors(),
      body: JSON.stringify({ error: "Missing env LLM_SITE (must be a publicly reachable LM Studio base URL)" })
    };
  }

  if (!LLM_MODEL) {
    return {
      statusCode: 500,
      headers: cors(),
      body: JSON.stringify({ error: "Missing env LLM_MODEL_ID" })
    };
  }

  let payload;
  try {
    payload = JSON.parse(event.body || "{}");
  } catch {
    return {
      statusCode: 400,
      headers: cors(),
      body: JSON.stringify({ error: "Invalid JSON body" })
    };
  }

  // We ignore any client-sent site/model and enforce server-side values:
  const forwardBody = {
    model: LLM_MODEL,
    messages: payload.messages || [],
    stream: payload.stream === true ? true : false,
    temperature: payload.temperature ?? 0.2
  };

  try {
    const url = new URL(LLM_PATH, LLM_SITE).toString();
    const resp = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(forwardBody)
    });

    const text = await resp.text();
    const contentType = resp.headers.get("content-type") || "application/json";

    return {
      statusCode: resp.status,
      headers: { ...cors(), "Content-Type": contentType },
      body: text
    };
  } catch (err) {
    return {
      statusCode: 502,
      headers: cors(),
      body: JSON.stringify({ error: "Upstream LM Studio request failed", detail: String(err && err.message || err) })
    };
  }
};

function cors() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS"
  };
}
