import { env } from "@/lib/env";

export const dynamic = "force-dynamic";

export function GET() {
  const key = env("TRACK_PUBLIC_KEY");
  const script = `(function(){
  var meta = document.querySelector('meta[name="ge-config"]');
  if (!window.__GE__ && meta) { try { window.__GE__ = JSON.parse(meta.getAttribute("content") || "{}"); } catch (e) {} }
  var cfg = window.__GE__ || {};
  var key = cfg.key || ${JSON.stringify(key)};
  function cookie(name){
    var match = document.cookie.match(new RegExp("(?:^|; )" + name + "=([^;]*)"));
    return match ? decodeURIComponent(match[1]) : "";
  }
  function aid(){
    if (cfg.aid) return cfg.aid;
    var fromCookie = cookie("ge_aid");
    if (fromCookie) return fromCookie;
    try {
      var existing = localStorage.getItem("ge_aid");
      if (existing) return existing;
      var created = (crypto.randomUUID && crypto.randomUUID()) || String(Date.now());
      localStorage.setItem("ge_aid", created);
      return created;
    } catch (e) { return "anon"; }
  }
  function send(event, properties){
    var variantNode = document.getElementById("ge-variant");
    var variant = cfg.variant || (variantNode ? variantNode.textContent.trim() : "");
    var ref = cfg.ref || cookie("ge_ref") || "";
    var payload = {
      event: event,
      anonymous_id: aid(),
      properties: Object.assign({ variant: variant, path: location.pathname, ref: ref }, properties || {}),
      context: { ref: ref, path: location.pathname }
    };
    if (key) payload.api_key = key;
    fetch(cfg.endpoint || "/api/track", {
      method: "POST",
      credentials: "include",
      headers: Object.assign({ "content-type": "application/json" }, key ? { "x-ge-key": key } : {}),
      body: JSON.stringify(payload)
    });
  }
  window.ge = { track: send };
  if (!cfg.manual) send("page_view", {});
})();`;
  return new Response(script, {
    headers: { "content-type": "application/javascript; charset=utf-8", "cache-control": "no-store" },
  });
}
