import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { ISPConfigClient } from "../ispconfig-client.js";

export function registerClientTools(server: McpServer, client: ISPConfigClient) {
  server.tool(
    "client_get",
    "Get client details by ID",
    { client_id: z.number().describe("Client ID") },
    async ({ client_id }) => {
      const result = await client.call("client_get", { client_id });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "client_add",
    "Create a new client",
    {
      reseller_id: z.number().describe("Reseller ID (0 for admin)"),
      params: z.record(z.string(), z.unknown()).describe("Client params (company_name, contact_name, username, password, email, etc.)"),
    },
    async ({ reseller_id, params }) => {
      const result = await client.call("client_add", { reseller_id, params });
      return { content: [{ type: "text", text: `Client created: ${JSON.stringify(result)}` }] };
    },
  );

  server.tool(
    "client_update",
    "Update a client",
    {
      client_id: z.number().describe("Client ID"),
      reseller_id: z.number().describe("Reseller ID"),
      params: z.record(z.string(), z.unknown()).describe("Fields to update"),
    },
    async ({ client_id, reseller_id, params }) => {
      const result = await client.call("client_update", {
        client_id,
        reseller_id,
        params,
      });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "client_delete",
    "Delete a client",
    { client_id: z.number().describe("Client ID") },
    async ({ client_id }) => {
      const result = await client.call("client_delete", { client_id });
      return { content: [{ type: "text", text: `Client deleted: ${JSON.stringify(result)}` }] };
    },
  );

  // --- Server ---

  server.tool(
    "server_get",
    "Get server information",
    {
      server_id: z.number().describe("Server ID"),
      section: z.string().default("").describe("Config section (empty for all)"),
    },
    async ({ server_id, section }) => {
      const result = await client.call("server_get", { server_id, section });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "server_get_by_ip",
    "Find server by IP address",
    { ip: z.string().describe("IP address") },
    async ({ ip }) => {
      const result = await client.call("server_get_serverid_by_ip", { ipaddress: ip });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  // --- Generic API call (escape hatch) ---

  server.tool(
    "api_call",
    "Call any ISPConfig API method directly (escape hatch for methods not covered by other tools)",
    {
      method: z.string().describe("API method name (e.g. 'mail_fetchmail_add')"),
      params: z.record(z.string(), z.unknown()).default({}).describe("Method parameters"),
    },
    async ({ method, params }) => {
      const result = await client.call(method, params);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );
}
