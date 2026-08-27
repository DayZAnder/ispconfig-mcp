#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { ISPConfigClient } from "./ispconfig-client.js";
import { registerDnsTools } from "./tools/dns.js";
import { registerMailTools } from "./tools/mail.js";
import { registerSitesTools } from "./tools/sites.js";
import { registerClientTools } from "./tools/client.js";
import { registerMigrationTools } from "./tools/migration.js";

function getEnvOrThrow(name: string): string {
  const value = process.env[name];
  if (!value) {
    console.error(`Missing required environment variable: ${name}`);
    process.exit(1);
  }
  return value;
}

async function main() {
  const ispconfigUrl = getEnvOrThrow("ISPCONFIG_URL");
  const ispconfigUser = getEnvOrThrow("ISPCONFIG_USER");
  const ispconfigPassword = getEnvOrThrow("ISPCONFIG_PASSWORD");
  const insecure = process.env.ISPCONFIG_INSECURE === "true";
  // When true, no create/update/delete/import tools are registered at all,
  // so the model cannot mutate the ISPConfig instance through this server.
  const readonly = process.env.ISPCONFIG_READONLY === "true";

  // TLS verification is handled per-client inside ISPConfigClient (scoped
  // dispatcher), never via the process-global NODE_TLS_REJECT_UNAUTHORIZED.

  const client = new ISPConfigClient({
    url: ispconfigUrl,
    username: ispconfigUser,
    password: ispconfigPassword,
    insecure,
  });

  // Optional destination instance for migrations
  let destClient: ISPConfigClient | null = null;
  if (process.env.ISPCONFIG_DEST_URL) {
    destClient = new ISPConfigClient({
      url: process.env.ISPCONFIG_DEST_URL,
      username: process.env.ISPCONFIG_DEST_USER ?? ispconfigUser,
      password: process.env.ISPCONFIG_DEST_PASSWORD ?? ispconfigPassword,
      insecure,
    });
  }

  const server = new McpServer({
    name: "ispconfig-mcp",
    version: "0.2.0",
  });

  // Register all tool groups
  const opts = { readonly };
  registerDnsTools(server, client, opts);
  registerMailTools(server, client, opts);
  registerSitesTools(server, client, opts);
  registerClientTools(server, client, opts);
  registerMigrationTools(server, client, destClient, opts);

  if (readonly) {
    console.error("ispconfig-mcp: running in READ-ONLY mode; write/delete/import tools are disabled.");
  }

  // Connect via stdio transport
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
