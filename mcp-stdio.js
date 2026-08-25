#!/usr/bin/env node
// ============================================================
// Stdio MCP entry point — for agents that launch an MCP server by command
// (Claude Desktop, Cursor, …). It serves the same tools as the HTTP /mcp
// endpoint by talking to the running app's REST API.
//
// The app (npm start) must be running so this bridge has an API to call. Point
// it at a non-default address with MCP_API_BASE, and enable write tools with
// MCP_ALLOW_WRITE=1.
//
//   Example Claude Desktop config:
//   {
//     "mcpServers": {
//       "k8s-manager": {
//         "command": "node",
//         "args": ["/absolute/path/to/k8s-manager-ui/mcp-stdio.js"],
//         "env": { "MCP_API_BASE": "http://127.0.0.1:3001", "MCP_ALLOW_WRITE": "0" }
//       }
//     }
//   }
// ============================================================
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createMcpServer } from './mcp.js';

const server = createMcpServer();
const transport = new StdioServerTransport();
await server.connect(transport);
// stderr is safe for logs (stdout is the JSON-RPC channel).
console.error('[k8s-manager MCP] stdio server ready');
