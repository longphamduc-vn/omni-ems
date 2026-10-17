export * from './types';
export * from './client';
import { emsClient, NexacroClient } from './client';

export const emsApi = {
  client: emsClient,
  createClient: (config?: any) => new NexacroClient(config)
};

export default emsApi;
