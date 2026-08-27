// Regression tests: assert each tool calls the ISPConfig remote API with the
// exact method name and parameter keys that ISPConfig actually expects.
// Verified against ISPConfig source: json_handler maps params by parameter
// NAME (ReflectionMethod), remoting_lib::getDataRecord treats primary_id=-1 as
// "all rows" and array values containing "%" as LIKE filters.
//
// Run: node --test
import test from "node:test";
import assert from "node:assert/strict";

import { registerDnsTools } from "../dist/tools/dns.js";
import { registerMailTools } from "../dist/tools/mail.js";
import { registerSitesTools } from "../dist/tools/sites.js";
import { registerMigrationTools } from "../dist/tools/migration.js";

/** Fake McpServer that captures registered tool handlers by name. */
function fakeServer() {
  const tools = new Map();
  return {
    tools,
    tool(name, _desc, _schema, handler) {
      tools.set(name, handler);
    },
  };
}

/** Fake ISPConfigClient that records every call and returns canned data. */
function fakeClient(responses = {}) {
  const calls = [];
  return {
    calls,
    async call(method, params = {}) {
      calls.push({ method, params });
      return method in responses ? responses[method] : [];
    },
  };
}

const RW = { readonly: false };

test("mail_domain_list uses mail_domain_get with primary_id=-1 (not the nonexistent *_get_by_user)", async () => {
  const server = fakeServer();
  const client = fakeClient();
  registerMailTools(server, client, RW);
  await server.tools.get("mail_domain_list")();
  assert.deepEqual(client.calls[0], { method: "mail_domain_get", params: { primary_id: -1 } });
});

test("list tools request all rows via primary_id/cron_id = -1", async () => {
  const server = fakeServer();
  const client = fakeClient();
  registerSitesTools(server, client, RW);

  await server.tools.get("web_domain_list")();
  assert.deepEqual(client.calls.at(-1), { method: "sites_web_domain_get", params: { primary_id: -1 } });

  await server.tools.get("ftp_user_list")();
  assert.deepEqual(client.calls.at(-1), { method: "sites_ftp_user_get", params: { primary_id: -1 } });

  await server.tools.get("database_list")();
  assert.deepEqual(client.calls.at(-1), { method: "sites_database_get", params: { primary_id: -1 } });

  // sites_cron_get's parameter is named `cron_id`, not `primary_id`.
  await server.tools.get("cron_list")();
  assert.deepEqual(client.calls.at(-1), { method: "sites_cron_get", params: { cron_id: -1 } });
});

test("cron update/delete pass cron_id (handler maps by parameter name)", async () => {
  const server = fakeServer();
  const client = fakeClient();
  registerSitesTools(server, client, RW);

  await server.tools.get("cron_update")({ client_id: 1, cron_id: 42, params: { command: "x" } });
  assert.deepEqual(client.calls.at(-1), {
    method: "sites_cron_update",
    params: { client_id: 1, cron_id: 42, params: { command: "x" } },
  });

  await server.tools.get("cron_delete")({ cron_id: 42 });
  assert.deepEqual(client.calls.at(-1), { method: "sites_cron_delete", params: { cron_id: 42 } });
});

test("dns zone export uses dns_rr_get_all_by_zone and groups by lowercased type", async () => {
  const server = fakeServer();
  const client = fakeClient({
    dns_zone_get: { id: 5, origin: "example.com." },
    dns_rr_get_all_by_zone: [
      { id: 1, type: "A", name: "@", data: "1.2.3.4" },
      { id: 2, type: "MX", name: "@", data: "mail" },
      { id: 3, type: "A", name: "www", data: "1.2.3.4" },
    ],
  });
  registerMigrationTools(server, client, null, RW);

  const res = await server.tools.get("migrate_export_dns_zone")({ zone_id: 5, include_secrets: true });
  const rrCall = client.calls.find((c) => c.method === "dns_rr_get_all_by_zone");
  assert.deepEqual(rrCall, { method: "dns_rr_get_all_by_zone", params: { zone_id: 5 } });

  const bundle = JSON.parse(res.content[0].text);
  assert.equal(bundle.children.a.length, 2);
  assert.equal(bundle.children.mx.length, 1);
});

test("mail domain export filters children with LIKE patterns on the address column", async () => {
  const server = fakeServer();
  const client = fakeClient({ mail_domain_get: { domain_id: 1, domain: "example.com" } });
  registerMigrationTools(server, client, null, RW);

  await server.tools.get("migrate_export_mail_domain")({ domain_id: 1, include_secrets: true });
  const byMethod = Object.fromEntries(client.calls.map((c) => [c.method, c.params]));
  assert.deepEqual(byMethod.mail_user_get, { primary_id: { email: "%@example.com" } });
  assert.deepEqual(byMethod.mail_alias_get, { primary_id: { source: "%@example.com" } });
  assert.deepEqual(byMethod.mail_forward_get, { primary_id: { source: "%@example.com" } });
  assert.deepEqual(byMethod.mail_catchall_get, { primary_id: { source: "@example.com" } });
});

test("web domain export filters children by parent_domain_id (cron via cron_id key)", async () => {
  const server = fakeServer();
  const client = fakeClient({ sites_web_domain_get: { domain_id: 7, domain: "example.com" } });
  registerMigrationTools(server, client, null, RW);

  await server.tools.get("migrate_export_web_domain")({ domain_id: 7, include_secrets: true });
  const byMethod = Object.fromEntries(client.calls.map((c) => [c.method, c.params]));
  assert.deepEqual(byMethod.sites_ftp_user_get, { primary_id: { parent_domain_id: 7 } });
  assert.deepEqual(byMethod.sites_shell_user_get, { primary_id: { parent_domain_id: 7 } });
  assert.deepEqual(byMethod.sites_database_get, { primary_id: { parent_domain_id: 7 } });
  assert.deepEqual(byMethod.sites_web_subdomain_get, { primary_id: { parent_domain_id: 7 } });
  assert.deepEqual(byMethod.sites_cron_get, { cron_id: { parent_domain_id: 7 } });
});

test("export redacts secret fields by default and includes them when asked", async () => {
  const server = fakeServer();
  const client = fakeClient({
    mail_domain_get: { domain_id: 1, domain: "example.com" },
    mail_user_get: [{ email: "a@example.com", password: "$1$hash", quota: 100 }],
  });
  registerMigrationTools(server, client, null, RW);

  const redacted = await server.tools.get("migrate_export_mail_domain")({ domain_id: 1, include_secrets: false });
  assert.match(redacted.content[0].text, /"password": "\*\*\*REDACTED\*\*\*"/);
  assert.doesNotMatch(redacted.content[0].text, /\$1\$hash/);

  const full = await server.tools.get("migrate_export_mail_domain")({ domain_id: 1, include_secrets: true });
  assert.match(full.content[0].text, /\$1\$hash/);
});

test("read-only mode registers read tools but omits mutating ones", async () => {
  const ro = { readonly: true };

  const s1 = fakeServer();
  registerSitesTools(s1, fakeClient(), ro);
  assert.ok(s1.tools.has("web_domain_list"), "read tool present");
  assert.ok(!s1.tools.has("web_domain_add"), "write tool omitted");
  assert.ok(!s1.tools.has("cron_delete"), "delete tool omitted");

  const s2 = fakeServer();
  registerMigrationTools(s2, fakeClient(), null, ro);
  assert.ok(s2.tools.has("migrate_export_dns_zone"), "export present");
  assert.ok(s2.tools.has("migrate_verify"), "verify present");
  assert.ok(!s2.tools.has("migrate_import_dns_zone"), "import omitted");

  const s3 = fakeServer();
  registerDnsTools(s3, fakeClient(), ro);
  assert.ok(s3.tools.has("dns_record_get"), "dns read tool present");
  assert.ok(!s3.tools.has("dns_zone_delete"), "dns delete omitted");
});
