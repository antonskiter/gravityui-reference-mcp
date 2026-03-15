import fs from 'fs';
import { generateLlmsTxt, generateLlmsFullTxt } from './llms-txt.js';
import type { ComponentDef, TokenSet } from '../types.js';

const components: ComponentDef[] = JSON.parse(
  fs.readFileSync('data/components.json', 'utf-8')
);
const tokens: TokenSet = JSON.parse(
  fs.readFileSync('data/tokens.json', 'utf-8')
);

const llmsTxt = generateLlmsTxt(components, tokens);
const llmsFullTxt = generateLlmsFullTxt(components, tokens);

fs.writeFileSync('llms.txt', llmsTxt);
fs.writeFileSync('llms-full.txt', llmsFullTxt);

console.log(`llms.txt: ${llmsTxt.length} chars (~${Math.round(llmsTxt.length / 4)} tokens)`);
console.log(`llms-full.txt: ${llmsFullTxt.length} chars (~${Math.round(llmsFullTxt.length / 4)} tokens)`);
