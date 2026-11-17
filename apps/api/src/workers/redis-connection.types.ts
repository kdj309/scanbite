/** BullMQ connection options parsed from a redis:// URL. */
export type BullmqConnection = {
  host: string;
  port: number;
  username?: string;
  password?: string;
  maxRetriesPerRequest: null;
};
