# ispconfig-mcp

MCP (Model Context Protocol) server for [ISPConfig 3](https://www.ispconfig.org/) — manage DNS zones, mail domains, websites, databases, FTP users, cron jobs, and more through AI assistants like Claude.

## Features

- **DNS Management** — zones, A/AAAA/CNAME/MX/NS/TXT/SRV/PTR records
- **Mail Management** — domains, mailboxes, aliases, forwards, catchall, spamfilter
- **Site Management** — web domains, subdomains, alias domains
- **Database Management** — create/delete MySQL databases
- **FTP & Shell Users** — create and manage access accounts
- **Cron Jobs** — schedule and manage cron tasks
- **Client Management** — create/update/delete ISPConfig clients
- **Server Info** — query server details by ID or IP
- **Generic API Call** — escape hatch for any of the ~246 ISPConfig API methods

## Prerequisites

- Node.js 18+
- An ISPConfig 3 installation with the Remote API enabled
- API user credentials (ISPConfig → System → Remote Users)

## Installation

```bash
# Via npx (no install needed)
npx ispconfig-mcp

# Or install globally
npm install -g ispconfig-mcp
```

## Configuration

### Claude Code

```bash
claude mcp add ispconfig -- npx ispconfig-mcp
```

Then set environment variables in your shell or `.env`:

```bash
export ISPCONFIG_URL="https://your-server:8080"
export ISPCONFIG_USER="api_user"
export ISPCONFIG_PASSWORD="your_password"
# Optional: skip TLS verification for self-signed certs
export ISPCONFIG_INSECURE="true"
```

### Claude Desktop / Cursor / Windsurf

Add to your MCP config file:

```json
{
  "mcpServers": {
    "ispconfig": {
      "command": "npx",
      "args": ["-y", "ispconfig-mcp"],
      "env": {
        "ISPCONFIG_URL": "https://your-server:8080",
        "ISPCONFIG_USER": "api_user",
        "ISPCONFIG_PASSWORD": "your_password",
        "ISPCONFIG_INSECURE": "true"
      }
    }
  }
}
```

## ISPConfig Setup

1. Log into ISPConfig panel → **System** → **Remote Users**
2. Create a new remote user with API access
3. Select the functions you want to allow (or grant all)
4. Use these credentials as `ISPCONFIG_USER` / `ISPCONFIG_PASSWORD`

## Available Tools

### DNS

| Tool | Description |
|------|-------------|
| `dns_zone_list` | List all DNS zones |
| `dns_zone_get` | Get zone details by ID |
| `dns_zone_add` | Create a new zone |
| `dns_zone_update` | Update zone settings |
| `dns_zone_delete` | Delete a zone |
| `dns_record_get` | Get a record by type and ID |
| `dns_record_add` | Add a DNS record (A, AAAA, CNAME, MX, TXT, etc.) |
| `dns_record_update` | Update a DNS record |
| `dns_record_delete` | Delete a DNS record |

### Mail

| Tool | Description |
|------|-------------|
| `mail_domain_list` | List all mail domains |
| `mail_domain_get` | Get mail domain details |
| `mail_domain_add` | Create a mail domain |
| `mail_domain_delete` | Delete a mail domain |
| `mail_user_get` | Get mailbox details |
| `mail_user_add` | Create a mailbox |
| `mail_user_update` | Update mailbox settings |
| `mail_user_delete` | Delete a mailbox |
| `mail_alias_add` | Create a mail alias |
| `mail_alias_delete` | Delete a mail alias |
| `mail_forward_add` | Create a mail forward |
| `mail_forward_delete` | Delete a mail forward |
| `mail_catchall_add` | Create a catchall |
| `mail_spamfilter_whitelist_add` | Add to spamfilter whitelist |
| `mail_spamfilter_blacklist_add` | Add to spamfilter blacklist |

### Sites & Hosting

| Tool | Description |
|------|-------------|
| `web_domain_list` | List all websites |
| `web_domain_get` | Get website details |
| `web_domain_add` | Create a website |
| `web_domain_update` | Update website settings |
| `web_domain_delete` | Delete a website |
| `web_subdomain_add` | Create a subdomain |
| `web_subdomain_delete` | Delete a subdomain |
| `web_aliasdomain_add` | Create an alias domain |
| `ftp_user_list` | List FTP users |
| `ftp_user_add` | Create an FTP user |
| `ftp_user_update` | Update FTP user |
| `ftp_user_delete` | Delete an FTP user |
| `shell_user_add` | Create a shell user |
| `shell_user_delete` | Delete a shell user |
| `database_list` | List databases |
| `database_add` | Create a database |
| `database_delete` | Delete a database |
| `cron_list` | List cron jobs |
| `cron_add` | Create a cron job |
| `cron_update` | Update a cron job |
| `cron_delete` | Delete a cron job |

### Admin

| Tool | Description |
|------|-------------|
| `client_get` | Get client details |
| `client_add` | Create a client |
| `client_update` | Update a client |
| `client_delete` | Delete a client |
| `server_get` | Get server info |
| `server_get_by_ip` | Find server by IP |
| `api_call` | Call any ISPConfig API method directly |

## Example Prompts

Once connected, you can ask your AI assistant things like:

- "List all DNS zones on my server"
- "Add an A record for app.example.com pointing to 1.2.3.4"
- "Create a mailbox info@example.com with 1GB quota"
- "Add a mail forward from sales@example.com to team@example.com"
- "Show me all websites and their domains"
- "Create a cron job that runs /usr/local/bin/backup.sh every night at 2am"
- "Find all zones missing SPF records"

## Development

```bash
git clone https://github.com/DayZAnder/ispconfig-mcp.git
cd ispconfig-mcp
npm install
npm run build
```

## License

MIT
