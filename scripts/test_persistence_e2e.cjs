const axios = require('axios');

const API_BASE = 'http://localhost:8080/api';

async function runPersistenceTest() {
  console.log('========================================================');
  console.log('TESTING POSTGRESQL CRUD PERSISTENCE ACROSS SIMULATED F5');
  console.log('========================================================\n');

  // --- Step 1: Baseline Check ---
  console.log('[Step 1] Baseline check from PostgreSQL...');
  const hRes = await axios.get(`${API_BASE}/households?page=0&size=1000`);
  const rRes = await axios.get(`${API_BASE}/residents?page=0&size=3000`);
  console.log(`- Households in DB: ${hRes.data.length}`);
  console.log(`- Residents in DB: ${rRes.data.length}`);

  // --- Step 2: Test Create Household & Initial Residents ---
  console.log('\n[Step 2] Creating new household with 2 residents via API...');
  const newHouseholdPayload = {
    code: 'HK-TEST-PERSIST',
    houseNumber: '999',
    street: 'Đường Phan Văn Hớn',
    hamlet: 'Ấp Bắc Lân',
    neighborhoodGroup: 'Tổ 1',
    alley: 'Mặt tiền đường',
    ownerName: 'Trần Văn Kiểm Tra',
    ownerPhone: '0912345678',
    type: 'RESIDENTIAL',
    status: 'NORMAL',
    residentsCount: 2,
    maleCount: 1,
    femaleCount: 1,
    latitude: 10.8545,
    longitude: 106.6125,
    notes: 'Hộ dân test lưu database',
    residentsList: [
      {
        fullName: 'Trần Văn Kiểm Tra',
        birthYear: 1980,
        gender: 'Nam',
        relationship: 'Chủ hộ',
        residenceType: 'Thường trú',
        phone: '0912345678',
        notes: 'Chủ hộ test'
      },
      {
        fullName: 'Nguyễn Thị Hoa',
        birthYear: 1983,
        gender: 'Nữ',
        relationship: 'Vợ',
        residenceType: 'Thường trú',
        notes: 'Vợ test'
      }
    ]
  };

  // Create household
  const postHRes = await axios.post(`${API_BASE}/households`, {
    code: newHouseholdPayload.code,
    houseNumber: newHouseholdPayload.houseNumber,
    street: newHouseholdPayload.street,
    hamlet: newHouseholdPayload.hamlet,
    neighborhoodGroup: newHouseholdPayload.neighborhoodGroup,
    alley: newHouseholdPayload.alley,
    ownerName: newHouseholdPayload.ownerName,
    ownerPhone: newHouseholdPayload.ownerPhone,
    type: newHouseholdPayload.type,
    status: newHouseholdPayload.status,
    residentsCount: newHouseholdPayload.residentsCount,
    maleCount: newHouseholdPayload.maleCount,
    femaleCount: newHouseholdPayload.femaleCount,
    latitude: newHouseholdPayload.latitude,
    longitude: newHouseholdPayload.longitude,
    notes: newHouseholdPayload.notes
  });
  const createdHId = postHRes.data.id;
  console.log(`✓ Household created with ID: ${createdHId}, Code: ${postHRes.data.code}`);

  // Create initial residents linked to this household
  const savedResidents = [];
  for (const r of newHouseholdPayload.residentsList) {
    const postRRes = await axios.post(`${API_BASE}/residents`, {
      fullName: r.fullName,
      birthYear: r.birthYear,
      gender: r.gender === 'Nữ' ? 'FEMALE' : 'MALE',
      relationship: r.relationship,
      residenceType: 'PERMANENT',
      notes: r.notes,
      household: { id: createdHId }
    });
    savedResidents.push(postRRes.data);
  }
  console.log(`✓ Created ${savedResidents.length} linked residents in DB.`);

  // --- Step 3: Verify Persistence in PostgreSQL ---
  console.log('\n[Step 3] Querying PostgreSQL directly for created data...');
  const verifyH = await axios.get(`${API_BASE}/households/${createdHId}`);
  const verifyR = await axios.get(`${API_BASE}/residents?householdId.equals=${createdHId}`);
  console.log(`- Retrieved Household: ${verifyH.data.ownerName} (${verifyH.data.code})`);
  console.log(`- Retrieved Residents count: ${verifyR.data.length}`);
  if (verifyR.data.length !== 2) throw new Error('Residents count mismatch!');

  // --- Step 4: Test Update Household Info & Add 3rd Resident ---
  console.log('\n[Step 4] Updating household info & adding a 3rd resident (con trai)...');
  const updateHRes = await axios.put(`${API_BASE}/households/${createdHId}`, {
    ...verifyH.data,
    ownerName: 'Trần Văn Kiểm Tra (ĐÃ SỬA)',
    notes: 'Ghi chú đã được cập nhật qua modal',
    residentsCount: 3,
    maleCount: 2,
    femaleCount: 1
  });
  console.log(`✓ Updated ownerName in DB: "${updateHRes.data.ownerName}"`);

  // Add 3rd resident
  const r3Res = await axios.post(`${API_BASE}/residents`, {
    fullName: 'Trần Văn Con',
    birthYear: 2010,
    gender: 'MALE',
    relationship: 'Con',
    residenceType: 'PERMANENT',
    notes: 'Con trai',
    household: { id: createdHId }
  });
  console.log(`✓ Added 3rd resident: ${r3Res.data.fullName} (ID: ${r3Res.data.id})`);

  // --- Step 5: Simulate Page Reload (F5) ---
  console.log('\n[Step 5] Simulating Browser Reload (F5) - re-fetching full dataset...');
  const [f5Households, f5Residents] = await Promise.all([
    axios.get(`${API_BASE}/households?page=0&size=1000&sort=id,asc`),
    axios.get(`${API_BASE}/residents?page=0&size=3000&sort=id,asc`)
  ]);

  const reloadedH = f5Households.data.find((h) => h.id === createdHId);
  const reloadedResidentsForH = f5Residents.data.filter((r) => r.household?.id === createdHId);

  console.log('- Reloaded household from DB:', reloadedH ? { id: reloadedH.id, ownerName: reloadedH.ownerName, notes: reloadedH.notes } : 'NOT FOUND!');
  console.log(`- Reloaded residents count for household ${createdHId}: ${reloadedResidentsForH.length}`);
  reloadedResidentsForH.forEach((r, idx) => {
    console.log(`  ${idx + 1}. ${r.fullName} (${r.relationship}, ${r.gender})`);
  });

  if (!reloadedH || reloadedH.ownerName !== 'Trần Văn Kiểm Tra (ĐÃ SỬA)') {
    throw new Error('FAILED: Household edit did not persist after reload!');
  }
  if (reloadedResidentsForH.length !== 3) {
    throw new Error(`FAILED: Expected 3 residents after reload, found ${reloadedResidentsForH.length}`);
  }
  console.log('✓ RELOAD TEST PASSED: All updates persisted 100% in PostgreSQL!');

  // --- Step 6: Test Delete Household and Cleanup ---
  console.log('\n[Step 6] Testing Delete Household and its linked residents...');
  // Delete residents first
  for (const r of reloadedResidentsForH) {
    await axios.delete(`${API_BASE}/residents/${r.id}`);
  }
  console.log(`✓ Deleted ${reloadedResidentsForH.length} residents.`);

  // Delete household
  await axios.delete(`${API_BASE}/households/${createdHId}`);
  console.log(`✓ Deleted household ID: ${createdHId}.`);

  // Verify deletion after reload
  try {
    await axios.get(`${API_BASE}/households/${createdHId}`);
    throw new Error('FAILED: Household still exists!');
  } catch (err) {
    if (err.response?.status === 404) {
      console.log('✓ Verified 404 Not Found in PostgreSQL: Household permanently removed.');
    } else {
      throw err;
    }
  }

  console.log('\n========================================================');
  console.log('>>> ALL CRUD & RELOAD PERSISTENCE TESTS PASSED 100%! <<<');
  console.log('========================================================');
}

runPersistenceTest().catch((err) => {
  console.error('\n❌ TEST FAILED:', err.response ? { status: err.response.status, data: err.response.data } : err.message);
  process.exit(1);
});
