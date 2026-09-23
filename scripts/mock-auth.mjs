// Local UI test service. Never deployed or used by the application in production.
import http from "node:http";
const owner = "11111111-1111-4111-8111-111111111111";
let workspace = {
  owner_id: owner,
  watchlist: ["MSFT", "NVDA", "ASML.AS"],
  ideas: [],
};
const user = {
  id: owner,
  email: "test@example.test",
  email_confirmed_at: new Date().toISOString(),
  is_anonymous: false,
  app_metadata: { provider: "email" },
  user_metadata: {},
  aud: "authenticated",
  created_at: new Date().toISOString(),
};
const token = [
  { alg: "HS256", typ: "JWT" },
  {
    sub: owner,
    aud: "authenticated",
    role: "authenticated",
    exp: Math.floor(Date.now() / 1000) + 3600,
  },
  "local-only",
]
  .map((x) =>
    Buffer.from(typeof x === "string" ? x : JSON.stringify(x)).toString(
      "base64url",
    ),
  )
  .join(".");
const server = http.createServer(async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "http://localhost:3100");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "authorization,apikey,content-type,x-client-info,x-supabase-api-version",
  );
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,PATCH,OPTIONS");
  res.setHeader("Content-Type", "application/json");
  if (req.method === "OPTIONS") {
    res.end();
    return;
  }
  if (req.url.startsWith("/auth/v1/token")) {
    res.end(
      JSON.stringify({
        access_token: token,
        refresh_token: "local-refresh",
        expires_in: 3600,
        token_type: "bearer",
        user,
      }),
    );
    return;
  }
  if (req.url.startsWith("/auth/v1/logout")) {
    res.end("{}");
    return;
  }
  if (req.headers.authorization !== `Bearer ${token}`) {
    res.statusCode = 401;
    res.end('{"message":"Invalid token"}');
    return;
  }
  if (req.url.startsWith("/auth/v1/user")) {
    res.end(JSON.stringify(user));
    return;
  }
  if (req.url.startsWith("/rest/v1/finance_workspace")) {
    if (req.method === "PATCH") {
      let raw = "";
      for await (const c of req) raw += c;
      workspace = { ...workspace, ...JSON.parse(raw) };
      res.end(JSON.stringify([{ ideas: workspace.ideas }]));
      return;
    }
    res.end(JSON.stringify(workspace));
    return;
  }
  res.statusCode = 404;
  res.end("{}");
});
server.listen(3101, "127.0.0.1", () =>
  console.log("Local-only auth fixture on 127.0.0.1:3101"),
);
