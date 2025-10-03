import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { getModelToken } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Material } from '../src/schema/material.schema';
import { MaterialLocation } from '../src/schema/material-location.schema';
import { MaterialPosition } from '../src/schema/material-position.schema';

async function seedMaterials() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const materialModel = app.get<Model<Material>>(getModelToken(Material.name));
  const locationModel = app.get<Model<MaterialLocation>>(
    getModelToken(MaterialLocation.name),
  );
  const positionModel = app.get<Model<MaterialPosition>>(
    getModelToken(MaterialPosition.name),
  );

  // ลบข้อมูลเก่า
  await materialModel.deleteMany({});

  // หา location IDs
  const wh01 = await locationModel.findOne({ location_code: 'WH-01' });
  const wh02 = await locationModel.findOne({ location_code: 'WH-02' });
  const prod01 = await locationModel.findOne({ location_code: 'PROD-01' });

  // หา position IDs (สุ่มเลือกมา)
  const posA11 = await positionModel.findOne({ position_code: 'A-1-1' });
  const posA12 = await positionModel.findOne({ position_code: 'A-1-2' });
  const posB11 = await positionModel.findOne({ position_code: 'B-1-1' });
  const posB12 = await positionModel.findOne({ position_code: 'B-1-2' });

  const materials = [
    // ========== Raw Materials ==========
    {
      material_number: 'MAT001',
      material_description: 'Plastic Resin PP (Polypropylene)',
      unit_of_measurement: 'KG',
      current_stock: [
        {
          location_id: wh01._id,
          position_id: posA11._id,
          stock_quantity: 500,
          lot_number: 'LOT2024001',
        },
        {
          location_id: wh02._id,
          position_id: posB11._id,
          stock_quantity: 300,
          lot_number: 'LOT2024002',
        },
        {
          location_id: prod01._id,
          stock_quantity: 50,
        },
      ],
    },
    {
      material_number: 'MAT002',
      material_description: 'Plastic Resin PE (Polyethylene)',
      unit_of_measurement: 'KG',
      current_stock: [
        {
          location_id: wh02._id,
          position_id: posB12._id,
          stock_quantity: 750,
          lot_number: 'LOT2024003',
        },
      ],
    },
    {
      material_number: 'MAT003',
      material_description: 'Colorant - Blue',
      unit_of_measurement: 'KG',
      current_stock: [
        {
          location_id: wh01._id,
          position_id: posA12._id,
          stock_quantity: 25,
          lot_number: 'CLR2024001',
        },
        {
          location_id: prod01._id,
          stock_quantity: 5,
        },
      ],
    },
    {
      material_number: 'MAT004',
      material_description: 'Colorant - Red',
      unit_of_measurement: 'KG',
      current_stock: [
        {
          location_id: wh01._id,
          stock_quantity: 20,
          lot_number: 'CLR2024002',
        },
      ],
    },
    {
      material_number: 'MAT005',
      material_description: 'Colorant - Black',
      unit_of_measurement: 'KG',
      current_stock: [
        {
          location_id: wh01._id,
          stock_quantity: 30,
          lot_number: 'CLR2024003',
        },
      ],
    },
    {
      material_number: 'MAT006',
      material_description: 'Additive - UV Stabilizer',
      unit_of_measurement: 'KG',
      current_stock: [
        {
          location_id: wh02._id,
          stock_quantity: 15,
          lot_number: 'ADD2024001',
        },
      ],
    },
    {
      material_number: 'MAT007',
      material_description: 'Additive - Flame Retardant',
      unit_of_measurement: 'KG',
      current_stock: [
        {
          location_id: wh02._id,
          stock_quantity: 10,
          lot_number: 'ADD2024002',
        },
      ],
    },
    {
      material_number: 'MAT008',
      material_description: 'Mold Release Agent',
      unit_of_measurement: 'L',
      current_stock: [
        {
          location_id: prod01._id,
          stock_quantity: 20,
          lot_number: 'MRA2024001',
        },
      ],
    },

    // ========== Packaging Materials ==========
    {
      material_number: 'PKG001',
      material_description: 'Cardboard Box - Small',
      unit_of_measurement: 'PCS',
      current_stock: [
        {
          location_id: wh01._id,
          stock_quantity: 500,
          lot_number: 'PKG2024001',
        },
      ],
    },
    {
      material_number: 'PKG002',
      material_description: 'Cardboard Box - Large',
      unit_of_measurement: 'PCS',
      current_stock: [
        {
          location_id: wh01._id,
          stock_quantity: 300,
          lot_number: 'PKG2024002',
        },
      ],
    },
    {
      material_number: 'PKG003',
      material_description: 'Plastic Wrap Film',
      unit_of_measurement: 'ROLL',
      current_stock: [
        {
          location_id: wh01._id,
          stock_quantity: 50,
          lot_number: 'PKG2024003',
        },
      ],
    },

    // ========== Materials with NO stock (for testing) ==========
    {
      material_number: 'MAT999',
      material_description: 'Test Material - No Stock',
      unit_of_measurement: 'KG',
      current_stock: [],
    },
  ];

  const inserted = await materialModel.insertMany(materials);
  console.log(`✅ Inserted ${inserted.length} materials with stock`);

  await app.close();
}

// Run if called directly
if (require.main === module) {
  seedMaterials()
    .then(() => {
      console.log('✅ Material seed completed');
      process.exit(0);
    })
    .catch((err) => {
      console.error('❌ Material seed failed:', err);
      process.exit(1);
    });
}

export { seedMaterials };
