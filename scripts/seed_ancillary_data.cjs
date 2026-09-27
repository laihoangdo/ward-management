const { Client } = require('pg');

async function seedAncillaryData() {
  const client = new Client({
    host: 'localhost',
    port: 5432,
    user: 'Monolithic',
    password: '',
    database: 'Monolithic'
  });

  await client.connect();
  console.log('Connected to PostgreSQL database Monolithic.');

  try {
    // 1. Seed area_zone (6 hamlets of Xã Bà Điểm)
    console.log('Clearing old area_zone faker data...');
    await client.query('DELETE FROM area_zone');

    const areaZones = [
      {
        code: 'KV-BD-BL',
        name: 'Khu vực Ấp Bắc Lân',
        hamlet_name: 'Ấp Bắc Lân',
        officer_in_charge: 'Đại úy Nguyễn Văn Bình',
        officer_phone: '0908123456',
        population_count: 242,
        household_count: 60,
        boundary_geo_json: JSON.stringify({ type: 'Polygon', coordinates: [[[106.605, 10.852], [106.612, 10.852], [106.612, 10.859], [106.605, 10.859], [106.605, 10.852]]] })
      },
      {
        code: 'KV-BD-NL',
        name: 'Khu vực Ấp Nam Lân',
        hamlet_name: 'Ấp Nam Lân',
        officer_in_charge: 'Thượng úy Trần Minh Tuấn',
        officer_phone: '0908234567',
        population_count: 238,
        household_count: 60,
        boundary_geo_json: JSON.stringify({ type: 'Polygon', coordinates: [[[106.608, 10.845], [106.615, 10.845], [106.615, 10.852], [106.608, 10.852], [106.608, 10.845]]] })
      },
      {
        code: 'KV-BD-TL',
        name: 'Khu vực Ấp Tây Lân',
        hamlet_name: 'Ấp Tây Lân',
        officer_in_charge: 'Đại úy Lê Hoàng Nam',
        officer_phone: '0908345678',
        population_count: 245,
        household_count: 60,
        boundary_geo_json: JSON.stringify({ type: 'Polygon', coordinates: [[[106.598, 10.848], [106.605, 10.848], [106.605, 10.855], [106.598, 10.855], [106.598, 10.848]]] })
      },
      {
        code: 'KV-BD-DL',
        name: 'Khu vực Ấp Đông Lân',
        hamlet_name: 'Ấp Đông Lân',
        officer_in_charge: 'Trung úy Phạm Đình Trọng',
        officer_phone: '0908456789',
        population_count: 235,
        household_count: 60,
        boundary_geo_json: JSON.stringify({ type: 'Polygon', coordinates: [[[106.612, 10.848], [106.619, 10.848], [106.619, 10.855], [106.612, 10.855], [106.612, 10.848]]] })
      },
      {
        code: 'KV-BD-HL',
        name: 'Khu vực Ấp Hậu Lân',
        hamlet_name: 'Ấp Hậu Lân',
        officer_in_charge: 'Thượng úy Võ Minh Tuấn',
        officer_phone: '0908567890',
        population_count: 240,
        household_count: 60,
        boundary_geo_json: JSON.stringify({ type: 'Polygon', coordinates: [[[106.602, 10.855], [106.609, 10.855], [106.609, 10.862], [106.602, 10.862], [106.602, 10.855]]] })
      },
      {
        code: 'KV-BD-TIENL',
        name: 'Khu vực Ấp Tiền Lân',
        hamlet_name: 'Ấp Tiền Lân',
        officer_in_charge: 'Đại úy Đỗ Hữu Nghĩa',
        officer_phone: '0908678901',
        population_count: 256,
        household_count: 60,
        boundary_geo_json: JSON.stringify({ type: 'Polygon', coordinates: [[[106.609, 10.855], [106.616, 10.855], [106.616, 10.862], [106.609, 10.862], [106.609, 10.855]]] })
      }
    ];

    for (let i = 0; i < areaZones.length; i++) {
      const z = areaZones[i];
      await client.query(`
        INSERT INTO area_zone (id, code, name, hamlet_name, officer_in_charge, officer_phone, population_count, household_count, boundary_geo_json)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      `, [i + 1, z.code, z.name, z.hamlet_name, z.officer_in_charge, z.officer_phone, z.population_count, z.household_count, z.boundary_geo_json]);
    }
    console.log(`Seeded ${areaZones.length} area zones.`);

    // 2. Seed document_record
    console.log('Clearing old document_record faker data...');
    await client.query('DELETE FROM document_record');

    const documents = [
      {
        doc_name: 'Giấy chứng nhận đủ điều kiện ANTT',
        doc_type: 'Giấy phép ANTT',
        household_name: 'Nhà nghỉ Mai Vàng',
        address: 'Số 45 Đường Phan Văn Hớn, Ấp Bắc Lân, Xã Bà Điểm',
        status: 'VALID',
        expiry_date: '2027-08-15',
        officer: 'Đại úy Nguyễn Văn Bình',
        phone: '0989024671',
        notes: 'Cơ sở kinh doanh lưu trú chấp hành tốt quy định khai báo khách cư trú.',
        reminder_sent: false
      },
      {
        doc_name: 'Biên bản kiểm tra an toàn PCCC & Cứu nạn',
        doc_type: 'Biên bản PCCC',
        household_name: 'Karaoke Ánh Sao Đêm',
        address: 'Số 88 Đường Nguyễn Ảnh Thủ, Ấp Nam Lân, Xã Bà Điểm',
        status: 'EXPIRING_SOON',
        expiry_date: '2026-10-10',
        officer: 'Thượng úy Trần Minh Tuấn',
        phone: '0903112233',
        notes: 'Hồ sơ thẩm duyệt PCCC định kỳ cần gia hạn trước ngày 10/10/2026.',
        reminder_sent: true
      },
      {
        doc_name: 'Bản cam kết không phát sinh tệ nạn xã hội',
        doc_type: 'Bản cam kết ANTT',
        household_name: 'Dãy trọ Công nhân Hòa Phát',
        address: 'Số 122/4 Đường Bà Điểm 4, Ấp Tây Lân, Xã Bà Điểm',
        status: 'VALID',
        expiry_date: '2027-01-01',
        officer: 'Đại úy Lê Hoàng Nam',
        phone: '0918445566',
        notes: 'Dãy trọ gồm 18 phòng, có camera an ninh kết nối CSKV.',
        reminder_sent: false
      },
      {
        doc_name: 'Giấy phép đủ điều kiện kinh doanh Gas/Khí đốt',
        doc_type: 'Giấy phép kinh doanh có điều kiện',
        household_name: 'Đại lý Gas Hóc Môn',
        address: 'Số 204 Đường Phan Văn Hớn, Ấp Tiền Lân, Xã Bà Điểm',
        status: 'VALID',
        expiry_date: '2027-05-20',
        officer: 'Đại úy Đỗ Hữu Nghĩa',
        phone: '0987654321',
        notes: 'Kho chứa gas tuân thủ khoảng cách an toàn chống cháy nổ.',
        reminder_sent: false
      },
      {
        doc_name: 'Hồ sơ thẩm định an ninh cơ sở Game/Internet',
        doc_type: 'Giấy phép kinh doanh',
        household_name: 'Cyber Game Bà Điểm',
        address: 'Số 15 Đường Bà Điểm 6, Ấp Đông Lân, Xã Bà Điểm',
        status: 'EXPIRED',
        expiry_date: '2026-08-30',
        officer: 'Trung úy Phạm Đình Trọng',
        phone: '0933778899',
        notes: 'Đã hết hạn giấy chứng nhận, đã lập biên bản yêu cầu làm thủ tục cấp mới.',
        reminder_sent: true
      },
      {
        doc_name: 'Sổ quản lý lưu trú & người nước ngoài',
        doc_type: 'Sổ quản lý cư trú',
        household_name: 'Khách sạn Hoàng Long',
        address: 'Số 56 Đường Quốc Lộ 22, Ấp Hậu Lân, Xã Bà Điểm',
        status: 'VALID',
        expiry_date: '2027-12-31',
        officer: 'Thượng úy Võ Minh Tuấn',
        phone: '0944556677',
        notes: 'Đã tích hợp phần mềm ASM khai báo lưu trú tự động qua VNeID.',
        reminder_sent: false
      },
      {
        doc_name: 'Biên bản kiểm tra điều kiện an ninh cơ sở massage',
        doc_type: 'Biên bản ANTT',
        household_name: 'Cơ sở Y học Cổ truyền Á Đông',
        address: 'Số 72 Đường Phan Văn Hớn, Ấp Bắc Lân, Xã Bà Điểm',
        status: 'EXPIRING_SOON',
        expiry_date: '2026-10-25',
        officer: 'Đại úy Nguyễn Văn Bình',
        phone: '0977223344',
        notes: 'Nhân viên có chứng chỉ hành nghề và hợp đồng lao động đầy đủ.',
        reminder_sent: false
      },
      {
        doc_name: 'Hồ sơ phòng ngừa tội phạm khu dân cư',
        doc_type: 'Hồ sơ nghiệp vụ',
        household_name: 'Khu dân cư Tiền Lân 1',
        address: 'Đường Phan Văn Hớn, Ấp Tiền Lân, Xã Bà Điểm',
        status: 'VALID',
        expiry_date: '2027-06-30',
        officer: 'Đại úy Đỗ Hữu Nghĩa',
        phone: '0908678901',
        notes: 'Tuyến đường có mô hình Tổ nhân dân tự quản kiểu mẫu về ANTT.',
        reminder_sent: false
      }
    ];

    for (let i = 0; i < documents.length; i++) {
      const d = documents[i];
      await client.query(`
        INSERT INTO document_record (id, doc_name, doc_type, household_name, address, status, expiry_date, officer, phone, notes, reminder_sent)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      `, [i + 1, d.doc_name, d.doc_type, d.household_name, d.address, d.status, d.expiry_date, d.officer, d.phone, d.notes, d.reminder_sent]);
    }
    console.log(`Seeded ${documents.length} document records.`);

    // 3. Seed patrol_log
    console.log('Clearing old patrol_log faker data...');
    await client.query('DELETE FROM patrol_log');

    const patrolLogs = [
      {
        action: 'Tuần tra an ninh trật tự ca đêm',
        target: 'Tuyến đường Phan Văn Hớn & Nguyễn Ảnh Thủ, Xã Bà Điểm',
        details: 'Phối hợp lực lượng bảo vệ an ninh trật tự cơ sở tuần tra khép kín địa bàn. Nhắc nhở 4 hộ dân để xe máy hớ hênh trước cửa nhà.',
        officer_name: 'Đại úy Nguyễn Văn Bình',
        badge_number: 'CSKV-0912',
        ip_address: '192.168.1.45',
        timestamp: '2026-09-27 22:30:00'
      },
      {
        action: 'Kiểm tra hành chính cơ sở lưu trú',
        target: 'Nhà nghỉ Mai Vàng & Nhà trọ Hưng Lân, Ấp Bắc Lân',
        details: 'Kiểm tra việc đăng ký lưu trú trên phần mềm ASM. 100% khách lưu trú đã được quét CCCD gắn chip đối soát cơ sở dữ liệu quốc gia.',
        officer_name: 'Đại úy Nguyễn Văn Bình',
        badge_number: 'CSKV-0912',
        ip_address: '192.168.1.45',
        timestamp: '2026-09-27 15:45:00'
      },
      {
        action: 'Giải tỏa trật tự lòng lề đường',
        target: 'Khu vực Chợ Bà Điểm, Đường Phan Văn Hớn, Ấp Tiền Lân',
        details: 'Tuyên truyền, vận động các hộ tiểu thương không lấn chiếm lòng lề đường làm nơi buôn bán, đảm bảo trật tự an toàn giao thông.',
        officer_name: 'Đại úy Đỗ Hữu Nghĩa',
        badge_number: 'CSKV-1045',
        ip_address: '192.168.1.50',
        timestamp: '2026-09-27 07:15:00'
      },
      {
        action: 'Kiểm tra an toàn PCCC dãy nhà trọ',
        target: 'Khu nhà trọ 24 phòng, Hẻm 418, Ấp Nam Lân',
        details: 'Kiểm tra lối thoát hiểm thứ 2, kiểm tra hoạt động của 6 bình chữa cháy bột MFZ4. Nhắc nhở người thuê trọ sạc xe điện đúng khu vực quy định.',
        officer_name: 'Thượng úy Trần Minh Tuấn',
        badge_number: 'CSKV-0887',
        ip_address: '192.168.1.48',
        timestamp: '2026-09-26 16:20:00'
      },
      {
        action: 'Tuyên truyền cảnh giác lừa đảo trên mạng',
        target: 'Hội trường Nhà Văn hóa Ấp Tây Lân, Xã Bà Điểm',
        details: 'Tổ chức buổi sinh hoạt chuyên đề phòng chống tội phạm công nghệ cao và hướng dẫn kích hoạt tài khoản định danh điện tử VNeID mức 2.',
        officer_name: 'Đại úy Lê Hoàng Nam',
        badge_number: 'CSKV-0734',
        ip_address: '192.168.1.52',
        timestamp: '2026-09-25 19:30:00'
      }
    ];

    for (let i = 0; i < patrolLogs.length; i++) {
      const p = patrolLogs[i];
      await client.query(`
        INSERT INTO patrol_log (id, action, target, details, officer_name, badge_number, ip_address, timestamp)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      `, [i + 1, p.action, p.target, p.details, p.officer_name, p.badge_number, p.ip_address, p.timestamp]);
    }
    console.log(`Seeded ${patrolLogs.length} patrol logs.`);

    // 4. Seed security_alert
    console.log('Clearing old security_alert faker data...');
    await client.query('DELETE FROM security_alert');

    const securityAlerts = [
      {
        alert_type: 'CANH_BAO_AN_NINH',
        severity: 'WARNING',
        title: 'Tụ tập nhóm thanh thiếu niên đêm khuya',
        description: 'Phát hiện nhóm 6 thanh thiếu niên điều khiển xe máy tụ tập nẹt pô tại đầu hẻm Đường Bà Điểm 4. Lực lượng tuần tra đã có mặt giải tán kịp thời.',
        location: 'Hẻm Đường Bà Điểm 4, Ấp Tây Lân, Xã Bà Điểm',
        is_resolved: true,
        reported_at: '2026-09-27 01:15:00',
        resolved_at: '2026-09-27 01:40:00'
      },
      {
        alert_type: 'NHAC_NHO_CU_TRU',
        severity: 'INFO',
        title: 'Cơ sở lưu trú chưa cập nhật thông tin khách nước ngoài',
        description: 'Nhà nghỉ Mai Vàng tiếp nhận 1 chuyên gia nước ngoài thuê phòng lúc 18h nhưng chưa đẩy dữ liệu lên hệ thống khai báo xuất nhập cảnh.',
        location: 'Số 45 Đường Phan Văn Hớn, Ấp Bắc Lân, Xã Bà Điểm',
        is_resolved: false,
        reported_at: '2026-09-27 19:00:00',
        resolved_at: null
      },
      {
        alert_type: 'CANH_BAO_PCCC',
        severity: 'CRITICAL',
        title: 'Vật cản che chắn lối thoát hiểm nhà xưởng',
        description: 'Phát hiện cơ sở may gia công tập kết thùng hàng bít lối cửa thoát nạn phía sau xưởng. Đã lập biên bản đình chỉ và yêu cầu di dời ngay.',
        location: 'Số 188 Đường Hưng Lân, Ấp Hậu Lân, Xã Bà Điểm',
        is_resolved: true,
        reported_at: '2026-09-26 14:30:00',
        resolved_at: '2026-09-26 16:00:00'
      },
      {
        alert_type: 'CANH_BAO_TRAT_TU',
        severity: 'WARNING',
        title: 'Hát karaoke loa kéo quá giờ quy định',
        description: 'Người dân phản ánh số nhà 92 Đường Bà Điểm 8 mở loa kéo âm lượng lớn sau 22h ảnh hưởng các hộ dân xung quanh. CSKV đã nhắc nhở và cam kết không tái phạm.',
        location: 'Số 92 Đường Bà Điểm 8, Ấp Đông Lân, Xã Bà Điểm',
        is_resolved: true,
        reported_at: '2026-09-25 22:45:00',
        resolved_at: '2026-09-25 23:10:00'
      }
    ];

    for (let i = 0; i < securityAlerts.length; i++) {
      const a = securityAlerts[i];
      await client.query(`
        INSERT INTO security_alert (id, alert_type, severity, title, description, location, is_resolved, reported_at, resolved_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      `, [i + 1, a.alert_type, a.severity, a.title, a.description, a.location, a.is_resolved, a.reported_at, a.resolved_at]);
    }
    console.log(`Seeded ${securityAlerts.length} security alerts.`);

    console.log('>>> ANCILLARY DATA SEEDED SUCCESSFULLY TO POSTGRESQL! <<<');
  } catch (err) {
    console.error('Error during seeding:', err);
  } finally {
    await client.end();
  }
}

seedAncillaryData();
