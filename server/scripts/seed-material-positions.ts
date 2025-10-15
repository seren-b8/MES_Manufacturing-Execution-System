import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { getModelToken } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { MaterialPosition } from '../src/schema/material-position.schema';
import { MaterialLocation } from '../src/schema/material-location.schema';

async function seedPositions() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const positionModel = app.get<Model<MaterialPosition>>(
    getModelToken(MaterialPosition.name),
  );
  const locationModel = app.get<Model<MaterialLocation>>(
    getModelToken(MaterialLocation.name),
  );

  // ลบข้อมูลเก่า
  await positionModel.deleteMany({});

  // หา locations ที่มี positions
  const locationsWithPositions = await locationModel
    .find({ has_positions: true, is_active: true })
    .exec();

  console.log(
    `Found ${locationsWithPositions.length} locations with positions`,
  );

  const allPositions = [];

  for (const location of locationsWithPositions) {
    console.log(`Generating positions for ${location.location_code}...`);

    let positions = [];

    switch (location.location_code) {
      case 'WH-01': // Main Warehouse - 5 rows x 10 columns
        positions = generatePositions(location, 'A', 5, 10);
        break;

      case 'WH-02': // Raw Material Storage - 4 rows x 8 columns
        positions = generatePositions(location, 'B', 4, 8);
        break;

      case 'WH-03': // Finished Goods - 6 rows x 12 columns
        positions = generatePositions(location, 'C', 6, 12);
        break;

      case 'QC-01': // Quarantine - 2 rows x 5 columns
        positions = generatePositions(location, 'Q', 2, 5);
        break;

      default:
        console.log(
          `No position generation rule for ${location.location_code}`,
        );
    }

    allPositions.push(...positions);
  }

  if (allPositions.length > 0) {
    const inserted = await positionModel.insertMany(allPositions);
    console.log(`✅ Inserted ${inserted.length} positions`);
  }

  await app.close();
}

// Helper function to generate positions
function generatePositions(
  location: any,
  shelfPrefix: string,
  rows: number,
  columns: number,
) {
  const positions = [];

  for (let row = 1; row <= rows; row++) {
    for (let col = 1; col <= columns; col++) {
      positions.push({
        location_id: location._id,
        position_code: `${shelfPrefix}-${row}-${col}`,
        shelf_code: shelfPrefix,
        row: row.toString(),
        column: col.toString(),
        is_occupied: false,
        current_materials: [],
      });
    }
  }

  return positions;
}

// Run if called directly
if (require.main === module) {
  seedPositions()
    .then(() => {
      console.log('✅ Position seed completed');
      process.exit(0);
    })
    .catch((err) => {
      console.error('❌ Position seed failed:', err);
      process.exit(1);
    });
}

export { seedPositions };
