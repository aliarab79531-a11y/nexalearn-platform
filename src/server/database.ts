import { MongoClient, type Db } from 'mongodb';
import { ApiError } from './api-errors';

let client: MongoClient | undefined;
let databasePromise: Promise<Db> | undefined;

export async function getDatabase(): Promise<Db> {
  const uri = process.env['MONGODB_URI'];
  if (!uri) {
    throw new ApiError(503, 'The data service is not configured.', 'DATABASE_NOT_CONFIGURED');
  }
  const databaseName = process.env['MONGODB_DB'] || 'nexalearn';

  client ??= new MongoClient(uri);
  databasePromise ??= client.connect()
    .then(() => client!.db(databaseName))
    .catch((error: unknown) => {
      databasePromise = undefined;
      console.error('MongoDB connection failed:', error);
      throw new ApiError(
        503,
        'The data service could not be reached. Check MongoDB connectivity and try again.',
        'DATABASE_UNAVAILABLE',
      );
    });
  return databasePromise;
}

export async function closeDatabase(): Promise<void> {
  const currentClient = client;
  client = undefined;
  databasePromise = undefined;
  if (currentClient) {
    await currentClient.close();
  }
}
