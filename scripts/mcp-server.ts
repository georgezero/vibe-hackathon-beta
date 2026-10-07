#!/usr/bin/env tsx

const baseUrl = process.env.VIBE_BASE_URL ?? "http://localhost:3000";

type JsonRpcRequest = {
  id?: string | number;
  method: string;
  params?: Record<string, unknown>;
};

const tools = [
  {
    name: "vibe.list_requirements",
    description: "Return Vibe Hackathon submission requirements.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "vibe.validate_repo",
    description: "Validate a public GitHub repo against deterministic requirements.",
    inputSchema: { type: "object", properties: { github_url: { type: "string" } }, required: ["github_url"] },
  },
  {
    name: "vibe.create_submission",
    description: "Create a draft submission and return an edit token.",
    inputSchema: { type: "object", properties: { teamName: { type: "string" }, contactEmail: { type: "string" } }, required: ["teamName", "contactEmail"] },
  },
  {
    name: "vibe.update_submission",
    description: "Update a draft submission with a bearer edit token.",
    inputSchema: { type: "object", properties: { id: { type: "string" }, editToken: { type: "string" } }, required: ["id", "editToken"] },
  },
  {
    name: "vibe.finalize_submission",
    description: "Finalize a submission and trigger deterministic review.",
    inputSchema: { type: "object", properties: { id: { type: "string" }, editToken: { type: "string" } }, required: ["id", "editToken"] },
  },
  {
    name: "vibe.get_submission_status",
    description: "Return submission status.",
    inputSchema: { type: "object", properties: { id: { type: "string" } }, required: ["id"] },
  },
];

async function request(path: string, init?: RequestInit) {
  const res = await fetch(`${baseUrl}${path}`, init);
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) throw new Error(JSON.stringify(data));
  return data;
}

async function callTool(name: string, args: Record<string, unknown>) {
  if (name === "vibe.list_requirements") return request("/api/v1/requirements");
  if (name === "vibe.validate_repo") {
    return request("/api/v1/validate-repo", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ github_url: args.github_url }),
    });
  }
  if (name === "vibe.create_submission") {
    return request("/api/v1/submissions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(args),
    });
  }
  if (name === "vibe.update_submission") {
    const { id, editToken, ...body } = args;
    return request(`/api/v1/submissions/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${editToken}` },
      body: JSON.stringify(body),
    });
  }
  if (name === "vibe.finalize_submission") {
    return request(`/api/v1/submissions/${args.id}/finalize`, {
      method: "POST",
      headers: { Authorization: `Bearer ${args.editToken}` },
    });
  }
  if (name === "vibe.get_submission_status") return request(`/api/v1/submissions/${args.id}/status`);
  throw new Error(`Unknown tool: ${name}`);
}

async function handle(req: JsonRpcRequest) {
  if (req.method === "initialize") return { protocolVersion: "2024-11-05", capabilities: { tools: {} }, serverInfo: { name: "vibe-hackathon", version: "1.0.0" } };
  if (req.method === "tools/list") return { tools };
  if (req.method === "tools/call") {
    const name = String(req.params?.name);
    const args = (req.params?.arguments ?? {}) as Record<string, unknown>;
    const result = await callTool(name, args);
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  }
  return {};
}

let buffer = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", (chunk) => {
  buffer += chunk;
  const lines = buffer.split("\n");
  buffer = lines.pop() ?? "";
  for (const line of lines) {
    if (!line.trim()) continue;
    const req = JSON.parse(line) as JsonRpcRequest;
    handle(req)
      .then((result) => process.stdout.write(`${JSON.stringify({ jsonrpc: "2.0", id: req.id, result })}\n`))
      .catch((error) => process.stdout.write(`${JSON.stringify({ jsonrpc: "2.0", id: req.id, error: { code: -32000, message: error.message } })}\n`));
  }
});
