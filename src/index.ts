#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { ISPConfigClient } from "./ispconfig-client.js";
import { registerDnsTools } from "./tools/dns.js";
import { registerMailTools } from "./tools/mail.js";
import { registerSitesTools } from "./tools/sites.js";
import { registerClientTools } from "./tools/client.js";

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

  if (insecure) {
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
  }

  const client = new ISPConfigClient({
    url: ispconfigUrl,
    username: ispconfigUser,
    password: ispconfigPassword,
    insecure,
  });

  const server = new McpServer({
    name: "ispconfig-mcp",
    version: "0.1.0",
  });

  // Register all tool groups
  registerDnsTools(server, client);
  registerMailTools(server, client);
  registerSitesTools(server, client);
  registerClientTools(server, client);

  // Connect via stdio transport
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
