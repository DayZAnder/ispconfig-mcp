import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { ISPConfigClient } from "../ispconfig-client.js";

/**
 * Migration export format — a full snapshot of an ISPConfig entity
 * and its children, suitable for importing to another instance.
 */
interface MigrationBundle {
  version: 1;
  exported_at: string;
  source: string;
  type: string;
  data: unknown;
  children: Record<string, unknown[]>;
}

/** Record types to export for a DNS zone */
const DNS_RECORD_TYPES = ["a", "aaaa", "cname", "mx", "ns", "txt", "srv", "ptr", "alias", "hinfo"] as const;

/** Strip ISPConfig internal IDs that shouldn't carry over to a new instance */
function stripIds(obj: Record<string, unknown>, keys: string[] = []): Record<string, unknown> {
  const strip = new Set(["sys_userid", "sys_groupid", "sys_perm_user", "sys_perm_group", "sys_perm_other", ...keys]);
  const cleaned: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (!strip.has(k)) {
      cleaned[k] = v;
    }
  }
  return cleaned;
}

export function registerMigrationTools(server: McpServer, source: ISPConfigClient, dest: ISPConfigClient | null) {
  // ──────────────────────────────────────────────
  // EXPORT tools — read from source, return JSON
  // ──────────────────────────────────────────────

  server.tool(
    "migrate_export_dns_zone",
    "Export a DNS zone with all its records as a migration bundle (JSON). Includes A, AAAA, CNAME, MX, NS, TXT, SRV, PTR records.",
    { zone_id: z.number().describe("Zone ID to export") },
    async ({ zone_id }) => {
      const zone = await source.call("dns_zone_get", { primary_id: zone_id }) as Record<string, unknown>;
      if (!zone) throw new Error(`Zone ${zone_id} not found`);

      const children: Record<string, unknown[]> = {};
      for (const rtype of DNS_RECORD_TYPES) {
        try {
          const records = await source.call(`dns_rr_get_by_zone`, { zone_id, primary_id: zone_id });
          if (Array.isArray(records)) {
            children[rtype] = records.filter((r: Record<string, unknown>) => String(r.type).toLowerCase() === rtype);
          }
        } catch {
          // Some record types may not exist — that's fine
        }
      }

      // Fallback: try individual record type queries if rr_get_by_zone didn't work
      if (Object.values(children).every(arr => arr.length === 0)) {
        for (const rtype of DNS_RECORD_TYPES) {
          try {
            const result = await source.call(`dns_${rtype}_get_by_zone`, { zone_id });
            if (Array.isArray(result)) {
              children[rtype] = result;
            }
          } catch {
            // Method may not exist for this record type
          }
        }
      }

      const bundle: MigrationBundle = {
        version: 1,
        exported_at: new Date().toISOString(),
        source: "ispconfig-mcp",
        type: "dns_zone",
        data: zone,
        children,
      };

      return { content: [{ type: "text", text: JSON.stringify(bundle, null, 2) }] };
    },
  );

  server.tool(
    "migrate_export_mail_domain",
    "Export a mail domain with all mailboxes, aliases, forwards, and catchall as a migration bundle",
    { domain_id: z.number().describe("Mail domain ID to export") },
    async ({ domain_id }) => {
      const domain = await source.call("mail_domain_get", { primary_id: domain_id }) as Record<string, unknown>;
      if (!domain) throw new Error(`Mail domain ${domain_id} not found`);

      const children: Record<string, unknown[]> = {};
      const domainName = domain.domain as string;

      // Get all mail users for this domain
      try {
        const users = await source.call("mail_user_get_by_domain", { domain: domainName });
        children.users = Array.isArray(users) ? users : [];
      } catch {
        children.users = [];
      }

      // Get aliases
      try {
        const aliases = await source.call("mail_alias_get_by_domain", { domain: domainName });
        children.aliases = Array.isArray(aliases) ? aliases : [];
      } catch {
        children.aliases = [];
      }

      // Get forwards
      try {
        const forwards = await source.call("mail_forward_get_by_domain", { domain: domainName });
        children.forwards = Array.isArray(forwards) ? forwards : [];
      } catch {
        children.forwards = [];
      }

      // Get catchall
      try {
        const catchall = await source.call("mail_catchall_get_by_domain", { domain: domainName });
        children.catchall = Array.isArray(catchall) ? catchall : [];
      } catch {
        children.catchall = [];
      }

      const bundle: MigrationBundle = {
        version: 1,
        exported_at: new Date().toISOString(),
        source: "ispconfig-mcp",
        type: "mail_domain",
        data: domain,
        children,
      };

      return { content: [{ type: "text", text: JSON.stringify(bundle, null, 2) }] };
    },
  );

  server.tool(
    "migrate_export_web_domain",
    "Export a web domain with FTP users, shell users, databases, cron jobs, and subdomains as a migration bundle",
    { domain_id: z.number().describe("Web domain ID to export") },
    async ({ domain_id }) => {
      const site = await source.call("sites_web_domain_get", { primary_id: domain_id }) as Record<string, unknown>;
      if (!site) throw new Error(`Web domain ${domain_id} not found`);

      const children: Record<string, unknown[]> = {};

      // FTP users
      try {
        const ftp = await source.call("sites_ftp_user_get_by_site", { parent_domain_id: domain_id });
        children.ftp_users = Array.isArray(ftp) ? ftp : [];
      } catch {
        children.ftp_users = [];
      }

      // Shell users
      try {
        const shell = await source.call("sites_shell_user_get_by_site", { parent_domain_id: domain_id });
        children.shell_users = Array.isArray(shell) ? shell : [];
      } catch {
        children.shell_users = [];
      }

      // Databases
      try {
        const dbs = await source.call("sites_database_get_by_site", { parent_domain_id: domain_id });
        children.databases = Array.isArray(dbs) ? dbs : [];
      } catch {
        children.databases = [];
      }

      // Cron jobs
      try {
        const crons = await source.call("sites_cron_get_by_site", { parent_domain_id: domain_id });
        children.cron_jobs = Array.isArray(crons) ? crons : [];
      } catch {
        children.cron_jobs = [];
      }

      // Subdomains
      try {
        const subs = await source.call("sites_web_subdomain_get_by_site", { parent_domain_id: domain_id });
        children.subdomains = Array.isArray(subs) ? subs : [];
      } catch {
        children.subdomains = [];
      }

      const bundle: MigrationBundle = {
        version: 1,
        exported_at: new Date().toISOString(),
        source: "ispconfig-mcp",
        type: "web_domain",
        data: site,
        children,
      };

      return { content: [{ type: "text", text: JSON.stringify(bundle, null, 2) }] };
    },
  );

  server.tool(
    "migrate_export_client",
    "Export a client account with all associated domains, mail, and sites as a migration bundle",
    { client_id: z.number().describe("Client ID to export") },
    async ({ client_id }) => {
      const clientData = await source.call("client_get", { client_id }) as Record<string, unknown>;
      if (!clientData) throw new Error(`Client ${client_id} not found`);

      const children: Record<string, unknown[]> = {};

      // Get all domains for this client
      try {
        const domains = await source.call("domains_get_all_by_user", { group_id: client_id });
        children.domains = Array.isArray(domains) ? domains : [];
      } catch {
        children.domains = [];
      }

      const bundle: MigrationBundle = {
        version: 1,
        exported_at: new Date().toISOString(),
        source: "ispconfig-mcp",
        type: "client",
        data: clientData,
        children,
      };

      return { content: [{ type: "text", text: JSON.stringify(bundle, null, 2) }] };
    },
  );

  // ──────────────────────────────────────────────
  // IMPORT tools — write to destination instance
  // ──────────────────────────────────────────────

  server.tool(
    "migrate_import_dns_zone",
    "Import a DNS zone migration bundle into the destination ISPConfig instance. Requires ISPCONFIG_DEST_URL to be configured.",
    {
      bundle_json: z.string().describe("The migration bundle JSON (from migrate_export_dns_zone)"),
      dest_server_id: z.number().describe("Target server ID on the destination instance"),
      dest_client_id: z.number().default(0).describe("Target client ID (0 for admin)"),
    },
    async ({ bundle_json, dest_server_id, dest_client_id }) => {
      const target = dest ?? source;
      const bundle = JSON.parse(bundle_json) as MigrationBundle;
      if (bundle.type !== "dns_zone") throw new Error(`Expected dns_zone bundle, got ${bundle.type}`);

      const zone = bundle.data as Record<string, unknown>;
      const zoneParams = stripIds(zone, ["id", "zone_id"]);
      zoneParams.server_id = dest_server_id;

      // Create zone
      const newZoneId = await target.call("dns_zone_add", {
        client_id: dest_client_id,
        params: zoneParams,
      });

      const results: string[] = [`Zone created: ID ${newZoneId}`];

      // Import records
      for (const [rtype, records] of Object.entries(bundle.children)) {
        for (const rec of records as Record<string, unknown>[]) {
          try {
            const recParams = stripIds(rec, ["id", "zone"]);
            recParams.zone = newZoneId;
            recParams.server_id = dest_server_id;
            const recId = await target.call(`dns_${rtype}_add`, {
              client_id: dest_client_id,
              params: recParams,
            });
            results.push(`  ${rtype} record created: ID ${recId}`);
          } catch (err) {
            results.push(`  ${rtype} record FAILED: ${err instanceof Error ? err.message : String(err)}`);
          }
        }
      }

      return { content: [{ type: "text", text: results.join("\n") }] };
    },
  );

  server.tool(
    "migrate_import_mail_domain",
    "Import a mail domain migration bundle into the destination ISPConfig instance. Creates domain, mailboxes, aliases, and forwards. NOTE: Actual maildir data must be rsynced separately.",
    {
      bundle_json: z.string().describe("The migration bundle JSON (from migrate_export_mail_domain)"),
      dest_server_id: z.number().describe("Target server ID on the destination instance"),
      dest_client_id: z.number().default(0).describe("Target client ID (0 for admin)"),
    },
    async ({ bundle_json, dest_server_id, dest_client_id }) => {
      const target = dest ?? source;
      const bundle = JSON.parse(bundle_json) as MigrationBundle;
      if (bundle.type !== "mail_domain") throw new Error(`Expected mail_domain bundle, got ${bundle.type}`);

      const domain = bundle.data as Record<string, unknown>;
      const domainParams = stripIds(domain, ["domain_id"]);
      domainParams.server_id = dest_server_id;

      // Create mail domain
      const newDomainId = await target.call("mail_domain_add", {
        client_id: dest_client_id,
        params: domainParams,
      });

      const results: string[] = [`Mail domain created: ID ${newDomainId} (${domain.domain})`];

      // Import mailboxes (NOTE: passwords will need to be reset or hashes may work if same scheme)
      for (const user of (bundle.children.users ?? []) as Record<string, unknown>[]) {
        try {
          const userParams = stripIds(user, ["mailuser_id"]);
          userParams.server_id = dest_server_id;
          const userId = await target.call("mail_user_add", {
            client_id: dest_client_id,
            params: userParams,
          });
          results.push(`  Mailbox created: ${user.email} (ID ${userId})`);
        } catch (err) {
          results.push(`  Mailbox FAILED (${user.email}): ${err instanceof Error ? err.message : String(err)}`);
        }
      }

      // Import aliases
      for (const alias of (bundle.children.aliases ?? []) as Record<string, unknown>[]) {
        try {
          const aliasParams = stripIds(alias, ["mail_alias_id"]);
          aliasParams.server_id = dest_server_id;
          await target.call("mail_alias_add", { client_id: dest_client_id, params: aliasParams });
          results.push(`  Alias created: ${alias.source} → ${alias.destination}`);
        } catch (err) {
          results.push(`  Alias FAILED: ${err instanceof Error ? err.message : String(err)}`);
        }
      }

      // Import forwards
      for (const fwd of (bundle.children.forwards ?? []) as Record<string, unknown>[]) {
        try {
          const fwdParams = stripIds(fwd, ["mail_forward_id"]);
          fwdParams.server_id = dest_server_id;
          await target.call("mail_forward_add", { client_id: dest_client_id, params: fwdParams });
          results.push(`  Forward created: ${fwd.source} → ${fwd.destination}`);
        } catch (err) {
          results.push(`  Forward FAILED: ${err instanceof Error ? err.message : String(err)}`);
        }
      }

      // Import catchall
      for (const ca of (bundle.children.catchall ?? []) as Record<string, unknown>[]) {
        try {
          const caParams = stripIds(ca, ["mail_catchall_id"]);
          caParams.server_id = dest_server_id;
          await target.call("mail_catchall_add", { client_id: dest_client_id, params: caParams });
          results.push(`  Catchall created: ${ca.source} → ${ca.destination}`);
        } catch (err) {
          results.push(`  Catchall FAILED: ${err instanceof Error ? err.message : String(err)}`);
        }
      }

      results.push("");
      results.push("IMPORTANT: Maildir data must be transferred separately via rsync:");
      results.push(`  rsync -avz source:/var/vmail/${domain.domain}/ dest:/var/vmail/${domain.domain}/`);

      return { content: [{ type: "text", text: results.join("\n") }] };
    },
  );

  server.tool(
    "migrate_import_web_domain",
    "Import a web domain migration bundle into the destination ISPConfig instance. Creates site, FTP/shell users, databases, cron jobs. NOTE: Website files and DB dumps must be transferred separately.",
    {
      bundle_json: z.string().describe("The migration bundle JSON (from migrate_export_web_domain)"),
      dest_server_id: z.number().describe("Target server ID on the destination instance"),
      dest_client_id: z.number().default(0).describe("Target client ID (0 for admin)"),
    },
    async ({ bundle_json, dest_server_id, dest_client_id }) => {
      const target = dest ?? source;
      const bundle = JSON.parse(bundle_json) as MigrationBundle;
      if (bundle.type !== "web_domain") throw new Error(`Expected web_domain bundle, got ${bundle.type}`);

      const site = bundle.data as Record<string, unknown>;
      const siteParams = stripIds(site, ["domain_id"]);
      siteParams.server_id = dest_server_id;

      // Create web domain
      const newSiteId = await target.call("sites_web_domain_add", {
        client_id: dest_client_id,
        params: siteParams,
      });

      const results: string[] = [`Web domain created: ${site.domain} (ID ${newSiteId})`];

      // Import subdomains
      for (const sub of (bundle.children.subdomains ?? []) as Record<string, unknown>[]) {
        try {
          const subParams = stripIds(sub, ["web_subdomain_id"]);
          subParams.server_id = dest_server_id;
          subParams.parent_domain_id = newSiteId;
          await target.call("sites_web_subdomain_add", { client_id: dest_client_id, params: subParams });
          results.push(`  Subdomain created: ${sub.domain}`);
        } catch (err) {
          results.push(`  Subdomain FAILED: ${err instanceof Error ? err.message : String(err)}`);
        }
      }

      // Import FTP users
      for (const ftp of (bundle.children.ftp_users ?? []) as Record<string, unknown>[]) {
        try {
          const ftpParams = stripIds(ftp, ["ftp_user_id"]);
          ftpParams.server_id = dest_server_id;
          ftpParams.parent_domain_id = newSiteId;
          await target.call("sites_ftp_user_add", { client_id: dest_client_id, params: ftpParams });
          results.push(`  FTP user created: ${ftp.username}`);
        } catch (err) {
          results.push(`  FTP user FAILED: ${err instanceof Error ? err.message : String(err)}`);
        }
      }

      // Import shell users
      for (const shell of (bundle.children.shell_users ?? []) as Record<string, unknown>[]) {
        try {
          const shellParams = stripIds(shell, ["shell_user_id"]);
          shellParams.server_id = dest_server_id;
          shellParams.parent_domain_id = newSiteId;
          await target.call("sites_shell_user_add", { client_id: dest_client_id, params: shellParams });
          results.push(`  Shell user created: ${shell.username}`);
        } catch (err) {
          results.push(`  Shell user FAILED: ${err instanceof Error ? err.message : String(err)}`);
        }
      }

      // Import databases (config only — actual data needs mysqldump)
      for (const db of (bundle.children.databases ?? []) as Record<string, unknown>[]) {
        try {
          const dbParams = stripIds(db, ["database_id"]);
          dbParams.server_id = dest_server_id;
          dbParams.parent_domain_id = newSiteId;
          await target.call("sites_database_add", { client_id: dest_client_id, params: dbParams });
          results.push(`  Database created: ${db.database_name}`);
        } catch (err) {
          results.push(`  Database FAILED: ${err instanceof Error ? err.message : String(err)}`);
        }
      }

      // Import cron jobs
      for (const cron of (bundle.children.cron_jobs ?? []) as Record<string, unknown>[]) {
        try {
          const cronParams = stripIds(cron, ["cron_id"]);
          cronParams.server_id = dest_server_id;
          cronParams.parent_domain_id = newSiteId;
          await target.call("sites_cron_add", { client_id: dest_client_id, params: cronParams });
          results.push(`  Cron job created: ${cron.command}`);
        } catch (err) {
          results.push(`  Cron FAILED: ${err instanceof Error ? err.message : String(err)}`);
        }
      }

      results.push("");
      results.push("IMPORTANT: Transfer actual data separately:");
      results.push(`  # Website files:`);
      results.push(`  rsync -avz source:/var/www/${site.domain}/ dest:/var/www/${site.domain}/`);
      results.push(`  # Database dumps (for each database):`);
      results.push(`  mysqldump -h source ${site.domain} | mysql -h dest ${site.domain}`);

      return { content: [{ type: "text", text: results.join("\n") }] };
    },
  );

  // ──────────────────────────────────────────────
  // MIGRATION PLAN — dry-run comparison
  // ──────────────────────────────────────────────

  server.tool(
    "migrate_plan",
    "Generate a migration plan: inventory what exists on the source and what would be created. Does NOT make any changes.",
    {
      scope: z.enum(["all", "dns", "mail", "sites"]).describe("What to inventory"),
    },
    async ({ scope }) => {
      const lines: string[] = ["# Migration Plan", ""];

      if (scope === "all" || scope === "dns") {
        lines.push("## DNS Zones");
        try {
          const zones = await source.call("dns_zone_get_by_user", { client_id: 0, server_id: 0 });
          if (Array.isArray(zones)) {
            lines.push(`Found ${zones.length} zone(s):`);
            for (const z of zones as Record<string, unknown>[]) {
              lines.push(`  - ${z.origin} (ID: ${z.id}, server: ${z.server_id}, active: ${z.active})`);
            }
          } else {
            lines.push("No zones found or unexpected response format.");
          }
        } catch (err) {
          lines.push(`Error fetching zones: ${err instanceof Error ? err.message : String(err)}`);
        }
        lines.push("");
      }

      if (scope === "all" || scope === "mail") {
        lines.push("## Mail Domains");
        try {
          const domains = await source.call("mail_domain_get_by_user", { client_id: 0, server_id: 0 });
          if (Array.isArray(domains)) {
            lines.push(`Found ${domains.length} mail domain(s):`);
            for (const d of domains as Record<string, unknown>[]) {
              lines.push(`  - ${d.domain} (ID: ${d.domain_id}, server: ${d.server_id}, active: ${d.active})`);
            }
          } else {
            lines.push("No mail domains found or unexpected response format.");
          }
        } catch (err) {
          lines.push(`Error fetching mail domains: ${err instanceof Error ? err.message : String(err)}`);
        }
        lines.push("");
      }

      if (scope === "all" || scope === "sites") {
        lines.push("## Web Domains");
        try {
          const sites = await source.call("sites_web_domain_get_by_user", { client_id: 0, server_id: 0 });
          if (Array.isArray(sites)) {
            lines.push(`Found ${sites.length} web domain(s):`);
            for (const s of sites as Record<string, unknown>[]) {
              lines.push(`  - ${s.domain} (ID: ${s.domain_id}, server: ${s.server_id}, type: ${s.type}, active: ${s.active})`);
            }
          } else {
            lines.push("No web domains found or unexpected response format.");
          }
        } catch (err) {
          lines.push(`Error fetching web domains: ${err instanceof Error ? err.message : String(err)}`);
        }
        lines.push("");
      }

      if (dest) {
        lines.push("## Destination Instance");
        lines.push("Destination ISPConfig is configured. Import tools are available.");
      } else {
        lines.push("## Destination Instance");
        lines.push("No destination configured. Set ISPCONFIG_DEST_URL to enable direct import.");
        lines.push("Alternatively, export bundles and import them manually.");
      }

      return { content: [{ type: "text", text: lines.join("\n") }] };
    },
  );

  server.tool(
    "migrate_data_commands",
    "Generate rsync/mysqldump commands needed to transfer actual data (files, mail, databases) between servers. These commands must be run manually — the MCP handles config only.",
    {
      type: z.enum(["mail", "website", "database"]).describe("Type of data to transfer"),
      domain: z.string().describe("Domain name (e.g. example.com)"),
      source_host: z.string().describe("Source server hostname/IP"),
      dest_host: z.string().describe("Destination server hostname/IP"),
      database_name: z.string().optional().describe("Database name (required for database type)"),
    },
    async ({ type, domain, source_host, dest_host, database_name }) => {
      const commands: string[] = [];

      if (type === "mail") {
        commands.push("# Transfer maildir data");
        commands.push(`rsync -avz --progress ${source_host}:/var/vmail/${domain}/ ${dest_host}:/var/vmail/${domain}/`);
        commands.push("");
        commands.push("# Fix ownership on destination");
        commands.push(`ssh ${dest_host} 'chown -R vmail:vmail /var/vmail/${domain}'`);
      }

      if (type === "website") {
        commands.push("# Transfer website files");
        commands.push(`rsync -avz --progress ${source_host}:/var/www/${domain}/ ${dest_host}:/var/www/${domain}/`);
        commands.push("");
        commands.push("# Fix ownership on destination");
        commands.push(`ssh ${dest_host} 'chown -R web$(id -u ${domain}):client$(id -g ${domain}) /var/www/${domain}'`);
        commands.push("");
        commands.push("# Or more commonly with ISPConfig:");
        commands.push(`ssh ${dest_host} 'chown -R www-data:www-data /var/www/${domain}/web'`);
      }

      if (type === "database") {
        const dbName = database_name ?? domain.replace(/\./g, "_");
        commands.push("# Dump from source and import to destination");
        commands.push(`ssh ${source_host} 'mysqldump --single-transaction ${dbName}' | ssh ${dest_host} 'mysql ${dbName}'`);
        commands.push("");
        commands.push("# Or two-step with intermediate file:");
        commands.push(`ssh ${source_host} 'mysqldump --single-transaction ${dbName}' > /tmp/${dbName}.sql`);
        commands.push(`scp /tmp/${dbName}.sql ${dest_host}:/tmp/`);
        commands.push(`ssh ${dest_host} 'mysql ${dbName} < /tmp/${dbName}.sql'`);
      }

      return { content: [{ type: "text", text: commands.join("\n") }] };
    },
  );

  // ──────────────────────────────────────────────
  // VERIFY — compare source vs destination
  // ──────────────────────────────────────────────

  server.tool(
    "migrate_verify",
    "Compare source and destination ISPConfig instances after migration. Shows what exists on source but is missing on destination, and flags any config mismatches. Requires ISPCONFIG_DEST_URL.",
    {
      scope: z.enum(["all", "dns", "mail", "sites"]).describe("What to verify"),
    },
    async ({ scope }) => {
      if (!dest) {
        return { content: [{ type: "text", text: "ERROR: No destination configured. Set ISPCONFIG_DEST_URL to use migrate_verify." }] };
      }

      const lines: string[] = ["# Migration Verification Report", ""];
      let totalMissing = 0;
      let totalMismatch = 0;
      let totalOk = 0;

      if (scope === "all" || scope === "dns") {
        lines.push("## DNS Zones");
        try {
          const srcZones = await source.call("dns_zone_get_by_user", { client_id: 0, server_id: 0 });
          const destZones = await dest.call("dns_zone_get_by_user", { client_id: 0, server_id: 0 });

          const srcList = Array.isArray(srcZones) ? srcZones as Record<string, unknown>[] : [];
          const destList = Array.isArray(destZones) ? destZones as Record<string, unknown>[] : [];
          const destOrigins = new Set(destList.map(z => String(z.origin)));

          for (const sz of srcList) {
            const origin = String(sz.origin);
            if (destOrigins.has(origin)) {
              lines.push(`  OK  ${origin}`);
              totalOk++;
            } else {
              lines.push(`  MISSING  ${origin}`);
              totalMissing++;
            }
          }

          // Check for extra zones on dest not on source
          const srcOrigins = new Set(srcList.map(z => String(z.origin)));
          for (const dz of destList) {
            if (!srcOrigins.has(String(dz.origin))) {
              lines.push(`  EXTRA (dest only)  ${dz.origin}`);
            }
          }

          lines.push(`  Summary: ${srcList.length} source, ${destList.length} dest, ${totalOk} matched, ${totalMissing} missing`);
        } catch (err) {
          lines.push(`  Error: ${err instanceof Error ? err.message : String(err)}`);
        }
        lines.push("");
      }

      if (scope === "all" || scope === "mail") {
        lines.push("## Mail Domains");
        let mailOk = 0, mailMissing = 0;
        try {
          const srcDomains = await source.call("mail_domain_get_by_user", { client_id: 0, server_id: 0 });
          const destDomains = await dest.call("mail_domain_get_by_user", { client_id: 0, server_id: 0 });

          const srcList = Array.isArray(srcDomains) ? srcDomains as Record<string, unknown>[] : [];
          const destList = Array.isArray(destDomains) ? destDomains as Record<string, unknown>[] : [];
          const destNames = new Set(destList.map(d => String(d.domain)));

          for (const sd of srcList) {
            const domain = String(sd.domain);
            if (destNames.has(domain)) {
              // Check mailbox counts
              let srcUserCount = 0, destUserCount = 0;
              try {
                const srcUsers = await source.call("mail_user_get_by_domain", { domain });
                srcUserCount = Array.isArray(srcUsers) ? srcUsers.length : 0;
              } catch { /* ignore */ }
              try {
                const destUsers = await dest.call("mail_user_get_by_domain", { domain });
                destUserCount = Array.isArray(destUsers) ? destUsers.length : 0;
              } catch { /* ignore */ }

              if (srcUserCount === destUserCount) {
                lines.push(`  OK  ${domain} (${srcUserCount} mailboxes)`);
                mailOk++;
                totalOk++;
              } else {
                lines.push(`  MISMATCH  ${domain} — source: ${srcUserCount} mailboxes, dest: ${destUserCount}`);
                mailMissing++;
                totalMismatch++;
              }
            } else {
              lines.push(`  MISSING  ${domain}`);
              mailMissing++;
              totalMissing++;
            }
          }

          lines.push(`  Summary: ${srcList.length} source, ${destList.length} dest, ${mailOk} matched, ${mailMissing} issues`);
        } catch (err) {
          lines.push(`  Error: ${err instanceof Error ? err.message : String(err)}`);
        }
        lines.push("");
      }

      if (scope === "all" || scope === "sites") {
        lines.push("## Web Domains");
        let siteOk = 0, siteMissing = 0;
        try {
          const srcSites = await source.call("sites_web_domain_get_by_user", { client_id: 0, server_id: 0 });
          const destSites = await dest.call("sites_web_domain_get_by_user", { client_id: 0, server_id: 0 });

          const srcList = Array.isArray(srcSites) ? srcSites as Record<string, unknown>[] : [];
          const destList = Array.isArray(destSites) ? destSites as Record<string, unknown>[] : [];
          const destNames = new Set(destList.map(s => String(s.domain)));

          for (const ss of srcList) {
            const domain = String(ss.domain);
            if (destNames.has(domain)) {
              lines.push(`  OK  ${domain}`);
              siteOk++;
              totalOk++;
            } else {
              lines.push(`  MISSING  ${domain}`);
              siteMissing++;
              totalMissing++;
            }
          }

          lines.push(`  Summary: ${srcList.length} source, ${destList.length} dest, ${siteOk} matched, ${siteMissing} missing`);
        } catch (err) {
          lines.push(`  Error: ${err instanceof Error ? err.message : String(err)}`);
        }
        lines.push("");
      }

      lines.push("---");
      lines.push(`Total: ${totalOk} OK, ${totalMissing} missing, ${totalMismatch} mismatched`);
      if (totalMissing === 0 && totalMismatch === 0) {
        lines.push("All source configs found on destination.");
      }

      return { content: [{ type: "text", text: lines.join("\n") }] };
    },
  );
}
