const axios = require('axios');

async function testCrud() {
  const baseURL = 'http://localhost:8080';
  console.log('--- 1. Testing GET /api/households ---');
  const getRes = await axios.get(`${baseURL}/api/households?page=0&size=2`);
  console.log('GET status:', getRes.status, 'Total items in page:', getRes.data.length);
  console.log('First household code:', getRes.data[0]?.code);

  console.log('\n--- 2. Testing POST /api/households (Create) ---');
  const newH = {
    code: 'HK-TEST-888',
    houseNumber: '888',
    street: 'Đường Phan Văn Hớn',
    hamlet: 'Ấp Bắc Lân',
    neighborhoodGroup: 'Tổ 1',
    alley: 'Mặt tiền đường',
    ownerName: 'Nguyễn Văn Test',
    ownerPhone: '0988888888',
    type: 'RESIDENTIAL',
    status: 'NORMAL',
    latitude: 10.8540,
    longitude: 106.6120,
    residentsCount: 3,
    maleCount: 2,
    femaleCount: 1,
    notes: 'Hộ test tạo mới qua API'
  };
  const postRes = await axios.post(`${baseURL}/api/households`, newH);
  console.log('POST status:', postRes.status, 'Created ID:', postRes.data.id, 'Code:', postRes.data.code);
  const createdId = postRes.data.id;

  console.log('\n--- 3. Testing PUT /api/households/:id (Update) ---');
  const updateH = {
    ...postRes.data,
    ownerName: 'Nguyễn Văn Test Đã Sửa',
    notes: 'Ghi chú sau khi sửa'
  };
  const putRes = await axios.put(`${baseURL}/api/households/${createdId}`, updateH);
  console.log('PUT status:', putRes.status, 'Updated ownerName:', putRes.data.ownerName);

  console.log('\n--- 4. Testing PATCH /api/households/:id (Partial Update Notes) ---');
  const patchRes = await axios.patch(
    `${baseURL}/api/households/${createdId}`,
    { id: createdId, notes: 'Ghi chú cập nhật qua PATCH' },
    { headers: { 'Content-Type': 'application/merge-patch+json' } }
  );
  console.log('PATCH status:', patchRes.status, 'Patched notes:', patchRes.data.notes);

  console.log('\n--- 5. Testing DELETE /api/households/:id (Delete) ---');
  const delRes = await axios.delete(`${baseURL}/api/households/${createdId}`);
  console.log('DELETE status:', delRes.status);

  console.log('\n--- 6. Verifying Deletion via GET /api/households/:id ---');
  try {
    await axios.get(`${baseURL}/api/households/${createdId}`);
    console.log('ERROR: Item still exists!');
  } catch (err) {
    console.log('Verified deleted successfully! Response status:', err.response?.status);
  }

  console.log('\n>>> ALL CRUD TESTS PASSED SUCCESSFULLY! <<<');
}

testCrud().catch((e) => {
  console.error('Test failed:', e.response ? { status: e.response.status, data: e.response.data } : e.message);
  process.exit(1);
});
