import { MongoClient, Db } from 'mongodb';

const uri = process.env.MONGODB_URI || '';
const options = {
  serverSelectionTimeoutMS: 5000,
  connectTimeoutMS: 5000,
};

let client: MongoClient | null = null;

if (!uri) {
  console.warn('⚠️ MONGODB_URI is not set in environment variables.');
}

export async function getDatabase(dbName: string = 'change_firewall'): Promise<Db> {
  if (!uri) {
    throw new Error('MONGODB_URI is not configured');
  }

  if (!client) {
    client = new MongoClient(uri, options);
  }

  try {
    await client.connect();
    return client.db(dbName);
  } catch (err) {
    // Reset client on failure so next request can retry freshly
    try {
      await client?.close();
    } catch {}
    client = null;
    throw err;
  }
}

export default getDatabase;
