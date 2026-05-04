#!/usr/bin/env node
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createServer } from './server.js';
import { logger } from './utils/logger.js';

async function main(): Promise<void> {
  const server = createServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  logger.info('Veilguard MCP server running on stdio');
}

main().catch((error) => {
  logger.error(`Fatal error: ${(error as Error).message}`);
  process.exit(1);
});
