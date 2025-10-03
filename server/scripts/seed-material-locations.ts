import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { getModelToken } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { MaterialLocation } from '../src/schema/material-location.schema';

async function seedLocations() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const locationModel = app.get<Model<MaterialLocation>>(
    getModelToken(MaterialLocation.name),
  );

  // ลบข้อมูลเก่า (ถ้ามี)
  await locationModel.deleteMany({});

  const locations = [
    // ========== Warehouses ==========
    {
      location_name: 'Main Warehouse',
      location_code: 'WH-01',
      location_type: 'warehouse',
      has_positions: true,
      position_format: 'A-{row}-{column}',
      description: 'Primary warehouse for raw materials and finished goods',
      is_active: true,
    },
    {
      location_name: 'Raw Material Storage',
      location_code: 'WH-02',
      location_type: 'warehouse',
      has_positions: true,
      position_format: 'B-{row}-{column}',
      description: 'Dedicated storage for raw materials',
      is_active: true,
    },
    {
      location_name: 'Finished Goods Warehouse',
      location_code: 'WH-03',
      location_type: 'warehouse',
      has_positions: true,
      position_format: 'C-{row}-{column}',
      description: 'Storage for finished products ready for shipment',
      is_active: true,
    },

    // ========== Production Areas ==========
    {
      location_name: 'Production Area 1',
      location_code: 'PROD-01',
      location_type: 'production',
      has_positions: false,
      description: 'Main production floor - Injection molding line 1',
      is_active: true,
    },
    {
      location_name: 'Production Area 2',
      location_code: 'PROD-02',
      location_type: 'production',
      has_positions: false,
      description: 'Injection molding line 2',
      is_active: true,
    },
    {
      location_name: 'Assembly Area',
      location_code: 'PROD-03',
      location_type: 'production',
      has_positions: false,
      description: 'Product assembly and packaging area',
      is_active: true,
    },

    // ========== Machine Locations ==========
    {
      location_name: 'Machine MC001',
      location_code: 'MC001',
      location_type: 'machine',
      has_positions: false,
      description: 'Injection molding machine 150T',
      is_active: true,
    },
    {
      location_name: 'Machine MC002',
      location_code: 'MC002',
      location_type: 'machine',
      has_positions: false,
      description: 'Injection molding machine 200T',
      is_active: true,
    },
    {
      location_name: 'Machine MC003',
      location_code: 'MC003',
      location_type: 'machine',
      has_positions: false,
      description: 'Injection molding machine 250T',
      is_active: true,
    },
    {
      location_name: 'Machine MC004',
      location_code: 'MC004',
      location_type: 'machine',
      has_positions: false,
      description: 'Injection molding machine 300T',
      is_active: true,
    },

    // ========== Other Locations ==========
    {
      location_name: 'Scrap Area',
      location_code: 'SCRAP-01',
      location_type: 'scrap',
      has_positions: false,
      description: 'Storage for defective and scrap materials',
      is_active: true,
    },
    {
      location_name: 'Quarantine Area',
      location_code: 'QC-01',
      location_type: 'quarantine',
      has_positions: true,
      position_format: 'Q-{row}-{column}',
      description: 'Quality control inspection and quarantine area',
      is_active: true,
    },
    {
      location_name: 'Staging Area',
      location_code: 'STAGE-01',
      location_type: 'staging',
      has_positions: false,
      description: 'Temporary staging area for material transfers',
      is_active: true,
    },

    // ========== Inactive Location (for testing) ==========
    {
      location_name: 'Old Warehouse',
      location_code: 'WH-OLD',
      location_type: 'warehouse',
      has_positions: false,
      description: 'Deprecated warehouse location',
      is_active: false,
    },
  ];

  const inserted = await locationModel.insertMany(locations);
  console.log(`✅ Inserted ${inserted.length} locations`);

  // Return IDs for position seeding
  const locationMap = {};
  inserted.forEach((loc) => {
    locationMap[loc.location_code] = loc._id;
  });

  await app.close();
  return locationMap;
}

// Run if called directly
if (require.main === module) {
  seedLocations()
    .then(() => {
      console.log('✅ Seed completed');
      process.exit(0);
    })
    .catch((err) => {
      console.error('❌ Seed failed:', err);
      process.exit(1);
    });
}

export { seedLocations };
