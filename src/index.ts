import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createServer } from './server.js';
import { getTier } from './license/license.js';
import { logger } from './utils/logger.js';

async function main(): Promise<void> {
  // Validate the license once, at startup. The resolved tier is reused for every
  // scan this session — we never call Polar per request.
  const tier = await getTier();
  const server = createServer(tier);
  const transport = new StdioServerTransport();
  await server.connect(transport);
  logger.info('Veilguard MCP server running on stdio');
}

main().catch((error) => {
  logger.error(`Fatal error: ${(error as Error).message}`);
  process.exit(1);
});
