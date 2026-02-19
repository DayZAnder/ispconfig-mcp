import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { ISPConfigClient } from "../ispconfig-client.js";

export function registerSitesTools(server: McpServer, client: ISPConfigClient) {
  // --- Web Domains ---

  server.tool(
    "web_domain_list",
    "List all web domains/sites",
    {},
    async () => {
      const result = await client.call("sites_web_domain_get", {
        client_id: 0,
        server_id: 0,
      });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "web_domain_get",
    "Get a web domain by ID",
    { domain_id: z.number().describe("Web domain ID") },
    async ({ domain_id }) => {
      const result = await client.call("sites_web_domain_get", { primary_id: domain_id });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "web_domain_add",
    "Create a new website/web domain",
    {
      client_id: z.number().describe("Client ID"),
      params: z.record(z.string(), z.unknown()).describe("Site params (server_id, domain, ip_address, type, etc.)"),
    },
    async ({ client_id, params }) => {
      const result = await client.call("sites_web_domain_add", { client_id, params });
      return { content: [{ type: "text", text: `Web domain created: ${JSON.stringify(result)}` }] };
    },
  );

  server.tool(
    "web_domain_update",
    "Update a web domain",
    {
      client_id: z.number().describe("Client ID"),
      domain_id: z.number().describe("Web domain ID"),
      params: z.record(z.string(), z.unknown()).describe("Fields to update"),
    },
    async ({ client_id, domain_id, params }) => {
      const result = await client.call("sites_web_domain_update", {
        client_id,
        primary_id: domain_id,
        params,
      });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "web_domain_delete",
    "Delete a web domain",
    { domain_id: z.number().describe("Web domain ID") },
    async ({ domain_id }) => {
      const result = await client.call("sites_web_domain_delete", { primary_id: domain_id });
      return { content: [{ type: "text", text: `Web domain deleted: ${JSON.stringify(result)}` }] };
    },
  );

  // --- Subdomains ---

  server.tool(
    "web_subdomain_add",
    "Create a subdomain",
    {
      client_id: z.number().describe("Client ID"),
      params: z.record(z.string(), z.unknown()).describe("Subdomain params"),
    },
    async ({ client_id, params }) => {
      const result = await client.call("sites_web_subdomain_add", { client_id, params });
      return { content: [{ type: "text", text: `Subdomain created: ${JSON.stringify(result)}` }] };
    },
  );

  server.tool(
    "web_subdomain_delete",
    "Delete a subdomain",
    { subdomain_id: z.number().describe("Subdomain ID") },
    async ({ subdomain_id }) => {
      const result = await client.call("sites_web_subdomain_delete", { primary_id: subdomain_id });
      return { content: [{ type: "text", text: `Subdomain deleted: ${JSON.stringify(result)}` }] };
    },
  );

  // --- Alias Domains ---

  server.tool(
    "web_aliasdomain_add",
    "Create a web alias domain",
    {
      client_id: z.number().describe("Client ID"),
      params: z.record(z.string(), z.unknown()).describe("Alias domain params"),
    },
    async ({ client_id, params }) => {
      const result = await client.call("sites_web_aliasdomain_add", { client_id, params });
      return { content: [{ type: "text", text: `Alias domain created: ${JSON.stringify(result)}` }] };
    },
  );

  // --- FTP Users ---

  server.tool(
    "ftp_user_list",
    "List FTP users",
    {},
    async () => {
      const result = await client.call("sites_ftp_user_get", {
        client_id: 0,
        server_id: 0,
      });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "ftp_user_add",
    "Create an FTP user",
    {
      client_id: z.number().describe("Client ID"),
      params: z.record(z.string(), z.unknown()).describe("FTP user params (server_id, parent_domain_id, username, password, etc.)"),
    },
    async ({ client_id, params }) => {
      const result = await client.call("sites_ftp_user_add", { client_id, params });
      return { content: [{ type: "text", text: `FTP user created: ${JSON.stringify(result)}` }] };
    },
  );

  server.tool(
    "ftp_user_update",
    "Update an FTP user",
    {
      client_id: z.number().describe("Client ID"),
      user_id: z.number().describe("FTP user ID"),
      params: z.record(z.string(), z.unknown()).describe("Fields to update"),
    },
    async ({ client_id, user_id, params }) => {
      const result = await client.call("sites_ftp_user_update", {
        client_id,
        primary_id: user_id,
        params,
      });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "ftp_user_delete",
    "Delete an FTP user",
    { user_id: z.number().describe("FTP user ID") },
    async ({ user_id }) => {
      const result = await client.call("sites_ftp_user_delete", { primary_id: user_id });
      return { content: [{ type: "text", text: `FTP user deleted: ${JSON.stringify(result)}` }] };
    },
  );

  // --- Shell Users ---

  server.tool(
    "shell_user_add",
    "Create a shell user",
    {
      client_id: z.number().describe("Client ID"),
      params: z.record(z.string(), z.unknown()).describe("Shell user params"),
    },
    async ({ client_id, params }) => {
      const result = await client.call("sites_shell_user_add", { client_id, params });
      return { content: [{ type: "text", text: `Shell user created: ${JSON.stringify(result)}` }] };
    },
  );

  server.tool(
    "shell_user_delete",
    "Delete a shell user",
    { user_id: z.number().describe("Shell user ID") },
    async ({ user_id }) => {
      const result = await client.call("sites_shell_user_delete", { primary_id: user_id });
      return { content: [{ type: "text", text: `Shell user deleted: ${JSON.stringify(result)}` }] };
    },
  );

  // --- Databases ---

  server.tool(
    "database_list",
    "List all databases",
    {},
    async () => {
      const result = await client.call("sites_database_get", {
        client_id: 0,
        server_id: 0,
      });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "database_add",
    "Create a new database",
    {
      client_id: z.number().describe("Client ID"),
      params: z.record(z.string(), z.unknown()).describe("Database params (server_id, parent_domain_id, type, database_name, etc.)"),
    },
    async ({ client_id, params }) => {
      const result = await client.call("sites_database_add", { client_id, params });
      return { content: [{ type: "text", text: `Database created: ${JSON.stringify(result)}` }] };
    },
  );

  server.tool(
    "database_delete",
    "Delete a database",
    { database_id: z.number().describe("Database ID") },
    async ({ database_id }) => {
      const result = await client.call("sites_database_delete", { primary_id: database_id });
      return { content: [{ type: "text", text: `Database deleted: ${JSON.stringify(result)}` }] };
    },
  );

  // --- Cron Jobs ---

  server.tool(
    "cron_list",
    "List all cron jobs",
    {},
    async () => {
      const result = await client.call("sites_cron_get", {
        client_id: 0,
        server_id: 0,
      });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cron_add",
    "Create a cron job",
    {
      client_id: z.number().describe("Client ID"),
      params: z.record(z.string(), z.unknown()).describe("Cron params (server_id, parent_domain_id, command, run_min, run_hour, etc.)"),
    },
    async ({ client_id, params }) => {
      const result = await client.call("sites_cron_add", { client_id, params });
      return { content: [{ type: "text", text: `Cron job created: ${JSON.stringify(result)}` }] };
    },
  );

  server.tool(
    "cron_update",
    "Update a cron job",
    {
      client_id: z.number().describe("Client ID"),
      cron_id: z.number().describe("Cron job ID"),
      params: z.record(z.string(), z.unknown()).describe("Fields to update"),
    },
    async ({ client_id, cron_id, params }) => {
      const result = await client.call("sites_cron_update", {
        client_id,
        primary_id: cron_id,
        params,
      });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "cron_delete",
    "Delete a cron job",
    { cron_id: z.number().describe("Cron job ID") },
    async ({ cron_id }) => {
      const result = await client.call("sites_cron_delete", { primary_id: cron_id });
      return { content: [{ type: "text", text: `Cron job deleted: ${JSON.stringify(result)}` }] };
    },
  );
}
