import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

const transport = new StdioClientTransport({
  command: 'node',
  args: ['/home/elmi/Documents/Projects/veilguard/dist/index.js'],
});

const client = new Client(
  { name: 'veilguard-local-check', version: '0.0.0' },
  { capabilities: {} },
);

await client.connect(transport);
const res = await client.listTools();
console.log(JSON.stringify(res, null, 2));
await client.close();
