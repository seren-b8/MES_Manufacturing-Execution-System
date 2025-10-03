import { seedLocations } from './seed-material-locations';
import { seedPositions } from './seed-material-positions';
import { seedMaterials } from './seed-materials';

async function seedAll() {
  console.log('🌱 Starting Material Management seed...\n');

  try {
    console.log('1️⃣ Seeding Locations...');
    await seedLocations();
    console.log('');

    console.log('2️⃣ Seeding Positions...');
    await seedPositions();
    console.log('');

    console.log('3️⃣ Seeding Materials with Stock...');
    await seedMaterials();
    console.log('');

    console.log('✅ All seeds completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Seed failed:', error);
    process.exit(1);
  }
}

seedAll();
