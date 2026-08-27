import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { ISPConfigClient } from "../ispconfig-client.js";
import { ToolOptions } from "./types.js";

export function registerMailTools(server: McpServer, client: ISPConfigClient, opts: ToolOptions) {
  // --- Mail Domains ---

  server.tool(
    "mail_domain_list",
    "List all mail domains",
    {},
    async () => {
      // ISPConfig has no mail_domain_get_by_user; primary_id = -1 returns all rows.
      const result = await client.call("mail_domain_get", { primary_id: -1 });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "mail_domain_get",
    "Get a mail domain by ID",
    { domain_id: z.number().describe("Mail domain ID") },
    async ({ domain_id }) => {
      const result = await client.call("mail_domain_get", { primary_id: domain_id });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "mail_user_get",
    "Get a mail user/mailbox by ID",
    { user_id: z.number().describe("Mail user ID") },
    async ({ user_id }) => {
      const result = await client.call("mail_user_get", { primary_id: user_id });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  // Everything below mutates the instance; skip it entirely in read-only mode.
  if (opts.readonly) return;

  server.tool(
    "mail_domain_add",
    "Create a new mail domain",
    {
      client_id: z.number().describe("Client ID"),
      params: z.record(z.string(), z.unknown()).describe("Domain params (server_id, domain, active)"),
    },
    async ({ client_id, params }) => {
      const result = await client.call("mail_domain_add", { client_id, params });
      return { content: [{ type: "text", text: `Mail domain created: ${JSON.stringify(result)}` }] };
    },
  );

  server.tool(
    "mail_domain_delete",
    "Delete a mail domain",
    { domain_id: z.number().describe("Mail domain ID") },
    async ({ domain_id }) => {
      const result = await client.call("mail_domain_delete", { primary_id: domain_id });
      return { content: [{ type: "text", text: `Domain deleted: ${JSON.stringify(result)}` }] };
    },
  );

  // --- Mail Users (Mailboxes) ---

  server.tool(
    "mail_user_add",
    "Create a new mailbox",
    {
      client_id: z.number().describe("Client ID"),
      params: z.record(z.string(), z.unknown()).describe("Mailbox params (server_id, email, password, name, quota, etc.)"),
    },
    async ({ client_id, params }) => {
      const result = await client.call("mail_user_add", { client_id, params });
      return { content: [{ type: "text", text: `Mailbox created: ${JSON.stringify(result)}` }] };
    },
  );

  server.tool(
    "mail_user_update",
    "Update a mailbox",
    {
      client_id: z.number().describe("Client ID"),
      user_id: z.number().describe("Mail user ID"),
      params: z.record(z.string(), z.unknown()).describe("Fields to update"),
    },
    async ({ client_id, user_id, params }) => {
      const result = await client.call("mail_user_update", {
        client_id,
        primary_id: user_id,
        params,
      });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "mail_user_delete",
    "Delete a mailbox",
    { user_id: z.number().describe("Mail user ID") },
    async ({ user_id }) => {
      const result = await client.call("mail_user_delete", { primary_id: user_id });
      return { content: [{ type: "text", text: `Mailbox deleted: ${JSON.stringify(result)}` }] };
    },
  );

  // --- Aliases ---

  server.tool(
    "mail_alias_add",
    "Create a mail alias",
    {
      client_id: z.number().describe("Client ID"),
      params: z.record(z.string(), z.unknown()).describe("Alias params (server_id, source, destination, active)"),
    },
    async ({ client_id, params }) => {
      const result = await client.call("mail_alias_add", { client_id, params });
      return { content: [{ type: "text", text: `Alias created: ${JSON.stringify(result)}` }] };
    },
  );

  server.tool(
    "mail_alias_delete",
    "Delete a mail alias",
    { alias_id: z.number().describe("Alias ID") },
    async ({ alias_id }) => {
      const result = await client.call("mail_alias_delete", { primary_id: alias_id });
      return { content: [{ type: "text", text: `Alias deleted: ${JSON.stringify(result)}` }] };
    },
  );

  // --- Forwards ---

  server.tool(
    "mail_forward_add",
    "Create a mail forward",
    {
      client_id: z.number().describe("Client ID"),
      params: z.record(z.string(), z.unknown()).describe("Forward params (server_id, source, destination, active)"),
    },
    async ({ client_id, params }) => {
      const result = await client.call("mail_forward_add", { client_id, params });
      return { content: [{ type: "text", text: `Forward created: ${JSON.stringify(result)}` }] };
    },
  );

  server.tool(
    "mail_forward_delete",
    "Delete a mail forward",
    { forward_id: z.number().describe("Forward ID") },
    async ({ forward_id }) => {
      const result = await client.call("mail_forward_delete", { primary_id: forward_id });
      return { content: [{ type: "text", text: `Forward deleted: ${JSON.stringify(result)}` }] };
    },
  );

  // --- Catchall ---

  server.tool(
    "mail_catchall_add",
    "Create a catchall for a mail domain",
    {
      client_id: z.number().describe("Client ID"),
      params: z.record(z.string(), z.unknown()).describe("Catchall params (server_id, source, destination)"),
    },
    async ({ client_id, params }) => {
      const result = await client.call("mail_catchall_add", { client_id, params });
      return { content: [{ type: "text", text: `Catchall created: ${JSON.stringify(result)}` }] };
    },
  );

  // --- Spamfilter ---

  server.tool(
    "mail_spamfilter_whitelist_add",
    "Add email/domain to spamfilter whitelist",
    {
      client_id: z.number().describe("Client ID"),
      params: z.record(z.string(), z.unknown()).describe("Whitelist params (server_id, wb, email, priority, active)"),
    },
    async ({ client_id, params }) => {
      const result = await client.call("mail_spamfilter_whitelist_add", { client_id, params });
      return { content: [{ type: "text", text: `Whitelist entry added: ${JSON.stringify(result)}` }] };
    },
  );

  server.tool(
    "mail_spamfilter_blacklist_add",
    "Add email/domain to spamfilter blacklist",
    {
      client_id: z.number().describe("Client ID"),
      params: z.record(z.string(), z.unknown()).describe("Blacklist params (server_id, wb, email, priority, active)"),
    },
    async ({ client_id, params }) => {
      const result = await client.call("mail_spamfilter_blacklist_add", { client_id, params });
      return { content: [{ type: "text", text: `Blacklist entry added: ${JSON.stringify(result)}` }] };
    },
  );
}
