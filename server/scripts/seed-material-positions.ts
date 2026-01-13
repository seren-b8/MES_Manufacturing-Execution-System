import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { getModelToken } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { MaterialPosition } from '../src/schema/material-position.schema';
import { MaterialLocation } from '../src/schema/material-location.schema';

// 1. สร้าง Config สำหรับแต่ละ Location ว่ามี Shelf อะไรบ้าง และมีกี่ช่อง
const shelfConfigs: Record<string, { prefix: string; count: number }[]> = {
  '1P10': [
    { prefix: 'A', count: 24 },
    { prefix: 'B', count: 24 },
    { prefix: 'C', count: 24 },
    { prefix: 'D', count: 28 },
    { prefix: 'E', count: 28 },
  ],
  // ถ้ามี Location อื่นเพิ่ม ก็ใส่ตรงนี้ได้เลย เช่น:
  // '2Z99': [ { prefix: 'A', count: 10 } ]
};

async function seedPositions() {
  const app = await NestFactory.createApplicationContext(AppModule);

  try {
    const positionModel = app.get<Model<MaterialPosition>>(
      getModelToken(MaterialPosition.name),
    );
    const locationModel = app.get<Model<MaterialLocation>>(
      getModelToken(MaterialLocation.name),
    );

    console.log('🗑️  Clearing old positions...');
    await positionModel.deleteMany({});

    // หา locations ที่ active และ set ว่ามี positions
    const locationsWithPositions = await locationModel
      .find({ has_positions: true, is_active: true })
      .exec();

    console.log(
      `🔎 Found ${locationsWithPositions.length} target locations in DB`,
    );

    const allPositions = [];

    for (const location of locationsWithPositions) {
      const config = shelfConfigs[location.location_code];

      if (!config) {
        console.warn(
          `⚠️  No configuration found for location: ${location.location_code} (Skipping)`,
        );
        continue;
      }

      console.log(`⚙️  Generating positions for ${location.location_code}...`);

      // Loop สร้างตาม Config ที่ตั้งไว้
      for (const shelf of config) {
        const positions = generatePositions(
          location,
          shelf.prefix,
          shelf.count,
        );
        allPositions.push(...positions);
      }
    }

    if (allPositions.length > 0) {
      console.log(
        `💾 Inserting ${allPositions.length} positions to Database...`,
      );
      const inserted = await positionModel.insertMany(allPositions);
      console.log(`✅ Successfully inserted ${inserted.length} positions`);
    } else {
      console.log('⚠️  No positions generated.');
    }
  } catch (error) {
    console.error('❌ Error seeding positions:', error);
  } finally {
    await app.close();
  }
}

// Helper function
function generatePositions(location: any, shelfPrefix: string, num: number) {
  const positions = [];

  for (let i = 1; i <= num; i++) {
    positions.push({
      location_id: location._id,
      position_code: `${shelfPrefix}${i}`, // ผลลัพธ์: A-1, A-2 ...
      shelf_code: shelfPrefix,
      row: '-',
      column: '-',
      is_occupied: false,
      current_materials: [],
    });
  }

  return positions;
}

// Run check
if (require.main === module) {
  seedPositions()
    .then(() => {
      console.log('🏁 Position seed script finished.');
      process.exit(0);
    })
    .catch((err) => {
      console.error('❌ Position seed script failed:', err);
      process.exit(1);
    });
}

export { seedPositions };
