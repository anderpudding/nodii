import { setupServer } from 'msw/node';
import { dataHandlers } from './data-fixtures';
export const server = setupServer(...dataHandlers);
