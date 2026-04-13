const { getStore } = require("@netlify/blobs");

exports.handler = async (event) => {
  const headers = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };

  // Handle CORS preflight
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers, body: "" };
  }

  // Extract PR number from query or referer
  const params = new URLSearchParams(event.queryStringParameters || {});
  const pr = params.get("pr") || "local";
  const page = params.get("page");

  if (!page) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: "Missing page parameter" }) };
  }

  const store = getStore("preview-comments");
  const blobKey = `pr-${pr}/${page}`.replace(/[^a-zA-Z0-9\-_\/\.]/g, "_");

  if (event.httpMethod === "GET") {
    try {
      const existing = await store.get(blobKey, { type: "json" });
      return { statusCode: 200, headers, body: JSON.stringify(existing || []) };
    } catch {
      return { statusCode: 200, headers, body: JSON.stringify([]) };
    }
  }

  if (event.httpMethod === "POST") {
    let body;
    try {
      body = JSON.parse(event.body);
    } catch {
      return { statusCode: 400, headers, body: JSON.stringify({ error: "Invalid JSON" }) };
    }

    const { author, text, selectedText, highlightId } = body;
    if (!author || !text) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: "Missing author or text" }) };
    }

    // Load existing comments
    let comments = [];
    try {
      const existing = await store.get(blobKey, { type: "json" });
      if (Array.isArray(existing)) comments = existing;
    } catch {}

    const comment = {
      author: author.slice(0, 100),
      text: text.slice(0, 2000),
      timestamp: new Date().toISOString(),
      page,
    };
    if (selectedText) comment.selectedText = selectedText.slice(0, 500);
    if (highlightId) comment.highlightId = highlightId;
    comments.push(comment);

    await store.setJSON(blobKey, comments);

    return { statusCode: 201, headers, body: JSON.stringify(comments) };
  }

  return { statusCode: 405, headers, body: JSON.stringify({ error: "Method not allowed" }) };
};
