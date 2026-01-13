import { registerAs } from '@nestjs/config';

export const databaseConfig = registerAs('database', () => ({
  mongodb: {
    uri: `mongodb://${process.env.MONGO_HOST}/${process.env.MONGO_DATABASE}`,
    options: {
      authSource: 'admin',
      user: process.env.MONGO_USER,
      pass: process.env.MONGO_PASS,
      ssl: false,
      tls: false,
      directConnection: true,
      retryWrites: true,
      family: 4,
      serverSelectionTimeoutMS: 15000,
      socketTimeoutMS: 60000,
      maxPoolSize: 30,
      minPoolSize: 5,
      maxIdleTimeMS: 30000,
      waitQueueTimeoutMS: 10000,
      // เพิ่มตัวเลือกใหม่เพื่อช่วยเพิ่มประสิทธิภาพ
      connectTimeoutMS: 15000, // เวลาที่รอในการเชื่อมต่อใหม่
      heartbeatFrequencyMS: 30000, // ตรวจสอบสถานะการเชื่อมต่อทุก 30 วินาที
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
