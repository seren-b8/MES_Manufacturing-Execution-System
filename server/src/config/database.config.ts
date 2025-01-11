import { registerAs } from '@nestjs/config';

export const databaseConfig = registerAs('database', () => ({
  mongodb: {
    uri: `mongodb://${process.env.MONGO_USER}:${process.env.MONGO_PASS}@${process.env.MONGO_HOST}/${process.env.MONGO_DATABASE}`,
    options: {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    },
  },
  sqlServer: {
    host: process.env.SQL_HOST,
    database: process.env.SQL_DATABASE,
    user: process.env.SQL_USER,
    password: process.env.SQL_PASS,
    options: {
      encrypt: true, // for azure
      trustServerCertificate: true, // change to true for local dev / self-signed certs
    },
  },
}));
