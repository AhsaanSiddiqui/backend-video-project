import mongoose from 'mongoose';
import { DB_NAME } from '../constants.js';

function buildMongoUri(baseUri, dbName) {
  const uri = (baseUri || '').trim();
  if (!uri) {
    throw new Error('MONGODB_URI is missing');
  }

  // Handle both:
  // mongodb+srv://host/?opts
  // mongodb+srv://host/dbname?opts
  // mongodb+srv://host
  const [withoutHash] = uri.split('#');
  const [beforeQuery, ...queryParts] = withoutHash.split('?');
  const query = queryParts.length ? `?${queryParts.join('?')}` : '';

  // Strip trailing slash and any existing db path after host
  const cleaned = beforeQuery.replace(/\/$/, '');
  const protocolSplit = cleaned.split('://');
  if (protocolSplit.length < 2) {
    throw new Error('Invalid MONGODB_URI');
  }

  const protocol = protocolSplit[0];
  const rest = protocolSplit.slice(1).join('://');
  const slashIndex = rest.indexOf('/');
  const hostPart = slashIndex === -1 ? rest : rest.slice(0, slashIndex);

  return `${protocol}://${hostPart}/${dbName}${query}`;
}

export const connectDB = async () => {
  try {
    const mongoUri = buildMongoUri(process.env.MONGODB_URI, DB_NAME);
    const connectionInstance = await mongoose.connect(mongoUri);
    console.log(
      `\n MONGODB connected !! DB HOST: ${connectionInstance.connection.host} | DB NAME: ${connectionInstance.connection.name} \n`,
    );
  } catch (error) {
    console.log('MONGODB connection Failed: ', error);
    process.exit(1);
  }
};
