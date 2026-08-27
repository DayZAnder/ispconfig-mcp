import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { ISPConfigClient } from "../ispconfig-client.js";
import { ToolOptions } from "./types.js";

/** DNS record types supported by ISPConfig */
const DNS_RECORD_TYPES = [
  "a", "aaaa", "alias", "cname", "hinfo", "mx", "ns", "ptr", "srv", "txt",
] as const;

export function registerDnsTools(server: McpServer, client: ISPConfigClient, opts: ToolOptions) {
  // --- Zones ---

  server.tool(
    "dns_zone_list",
    "List all DNS zones",
    {},
    async () => {
      const result = await client.call("dns_zone_get_by_user", {
        client_id: 0, // 0 = all for admin
        server_id: 0,
      });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "dns_zone_get",
    "Get a DNS zone by ID",
    { zone_id: z.number().describe("The zone ID") },
    async ({ zone_id }) => {
      const result = await client.call("dns_zone_get", { primary_id: zone_id });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "dns_record_get",
    "Get a DNS record by type and ID",
    {
      type: z.enum(DNS_RECORD_TYPES).describe("Record type (a, aaaa, cname, mx, txt, etc.)"),
      record_id: z.number().describe("Record ID"),
    },
    async ({ type, record_id }) => {
      const result = await client.call(`dns_${type}_get`, { primary_id: record_id });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  // Everything below mutates the instance; skip it entirely in read-only mode.
  if (opts.readonly) return;

  server.tool(
    "dns_zone_add",
    "Create a new DNS zone",
    {
      server_id: z.number().describe("Server ID"),
      client_id: z.number().describe("Client ID (0 for admin)"),
      origin: z.string().describe("Zone origin (e.g. example.com.)"),
      ns: z.string().describe("Primary nameserver"),
      mbox: z.string().describe("Admin email in DNS format (admin.example.com.)"),
      ttl: z.number().default(3600).describe("Default TTL"),
      refresh: z.number().default(7200),
      retry: z.number().default(540),
      expire: z.number().default(604800),
      minimum: z.number().default(86400),
      active: z.enum(["y", "n"]).default("y"),
    },
    async (params) => {
      const { server_id, client_id, ...zoneParams } = params;
      const result = await client.call("dns_zone_add", {
        client_id,
        params: { server_id, ...zoneParams },
      });
      return { content: [{ type: "text", text: `Zone created with ID: ${JSON.stringify(result)}` }] };
    },
  );

  server.tool(
    "dns_zone_update",
    "Update an existing DNS zone",
    {
      zone_id: z.number().describe("Zone ID to update"),
      client_id: z.number().describe("Client ID"),
      params: z.record(z.string(), z.unknown()).describe("Fields to update"),
    },
    async ({ zone_id, client_id, params }) => {
      const result = await client.call("dns_zone_update", {
        client_id,
        primary_id: zone_id,
        params,
      });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "dns_zone_delete",
    "Delete a DNS zone",
    { zone_id: z.number().describe("Zone ID to delete") },
    async ({ zone_id }) => {
      const result = await client.call("dns_zone_delete", { primary_id: zone_id });
      return { content: [{ type: "text", text: `Zone deleted: ${JSON.stringify(result)}` }] };
    },
  );

  // --- Records (generic for all record types) ---

  server.tool(
    "dns_record_add",
    "Add a DNS record to a zone",
    {
      type: z.enum(DNS_RECORD_TYPES).describe("Record type"),
      client_id: z.number().describe("Client ID"),
      params: z.record(z.string(), z.unknown()).describe("Record parameters (zone, name, data, ttl, etc.)"),
    },
    async ({ type, client_id, params }) => {
      const result = await client.call(`dns_${type}_add`, { client_id, params });
      return { content: [{ type: "text", text: `Record created: ${JSON.stringify(result)}` }] };
    },
  );

  server.tool(
    "dns_record_update",
    "Update a DNS record",
    {
      type: z.enum(DNS_RECORD_TYPES).describe("Record type"),
      record_id: z.number().describe("Record ID"),
      client_id: z.number().describe("Client ID"),
      params: z.record(z.string(), z.unknown()).describe("Fields to update"),
    },
    async ({ type, record_id, client_id, params }) => {
      const result = await client.call(`dns_${type}_update`, {
        client_id,
        primary_id: record_id,
        params,
      });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "dns_record_delete",
    "Delete a DNS record",
    {
      type: z.enum(DNS_RECORD_TYPES).describe("Record type"),
      record_id: z.number().describe("Record ID"),
    },
    async ({ type, record_id }) => {
      const result = await client.call(`dns_${type}_delete`, { primary_id: record_id });
      return { content: [{ type: "text", text: `Record deleted: ${JSON.stringify(result)}` }] };
    },
  );
}
