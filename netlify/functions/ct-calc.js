import { handler as incentivesHandler } from './ct-incentives-calc.js';

export async function handler(event) {
  return await incentivesHandler(event);
}
