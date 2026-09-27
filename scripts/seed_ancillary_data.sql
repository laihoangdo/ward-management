-- 1. Seed area_zone
DELETE FROM area_zone;

INSERT INTO area_zone (id, code, name, hamlet_name, officer_in_charge, officer_phone, population_count, household_count, boundary_geo_json)
VALUES 
(1, 'KV-BD-BL', 'Khu vực Ấp Bắc Lân', 'Ấp Bắc Lân', 'Đại úy Nguyễn Văn Bình', '0908123456', 242, 60, '{"type":"Polygon","coordinates":[[[106.605,10.852],[106.612,10.852],[106.612,10.859],[106.605,10.859],[106.605,10.852]]]}'),
(2, 'KV-BD-NL', 'Khu vực Ấp Nam Lân', 'Ấp Nam Lân', 'Thượng úy Trần Minh Tuấn', '0908234567', 238, 60, '{"type":"Polygon","coordinates":[[[106.608,10.845],[106.615,10.845],[106.615,10.852],[106.608,10.852],[106.608,10.845]]]}'),
(3, 'KV-BD-TL', 'Khu vực Ấp Tây Lân', 'Ấp Tây Lân', 'Đại úy Lê Hoàng Nam', '0908345678', 245, 60, '{"type":"Polygon","coordinates":[[[106.598,10.848],[106.605,10.848],[106.605,10.855],[106.598,10.855],[106.598,10.848]]]}'),
(4, 'KV-BD-DL', 'Khu vực Ấp Đông Lân', 'Ấp Đông Lân', 'Trung úy Phạm Đình Trọng', '0908456789', 235, 60, '{"type":"Polygon","coordinates":[[[106.612,10.848],[106.619,10.848],[106.619,10.855],[106.612,10.855],[106.612,10.848]]]}'),
(5, 'KV-BD-HL', 'Khu vực Ấp Hậu Lân', 'Ấp Hậu Lân', 'Thượng úy Võ Minh Tuấn', '0908567890', 240, 60, '{"type":"Polygon","coordinates":[[[106.602,10.855],[106.609,10.855],[106.609,10.862],[106.602,10.862],[106.602,10.855]]]}'),
(6, 'KV-BD-TIENL', 'Khu vực Ấp Tiền Lân', 'Ấp Tiền Lân', 'Đại úy Đỗ Hữu Nghĩa', '0908678901', 256, 60, '{"type":"Polygon","coordinates":[[[106.609,10.855],[106.616,10.855],[106.616,10.862],[106.609,10.862],[106.609,10.855]]]}');

-- 2. Seed document_record
DELETE FROM document_record;

INSERT INTO document_record (id, doc_name, doc_type, household_name, address, status, expiry_date, officer, phone, notes, reminder_sent)
VALUES
(1, 'Giấy chứng nhận đủ điều kiện ANTT', 'Giấy phép ANTT', 'Nhà nghỉ Mai Vàng', 'Số 45 Đường Phan Văn Hớn, Ấp Bắc Lân, Xã Bà Điểm', 'VALID', '2027-08-15', 'Đại úy Nguyễn Văn Bình', '0989024671', 'Cơ sở kinh doanh lưu trú chấp hành tốt quy định khai báo khách cư trú.', false),
(2, 'Biên bản kiểm tra an toàn PCCC & Cứu nạn', 'Biên bản PCCC', 'Karaoke Ánh Sao Đêm', 'Số 88 Đường Nguyễn Ảnh Thủ, Ấp Nam Lân, Xã Bà Điểm', 'EXPIRING_SOON', '2026-10-10', 'Thượng úy Trần Minh Tuấn', '0903112233', 'Hồ sơ thẩm duyệt PCCC định kỳ cần gia hạn trước ngày 10/10/2026.', true),
(3, 'Bản cam kết không phát sinh tệ nạn xã hội', 'Bản cam kết ANTT', 'Dãy trọ Công nhân Hòa Phát', 'Số 122/4 Đường Bà Điểm 4, Ấp Tây Lân, Xã Bà Điểm', 'VALID', '2027-01-01', 'Đại úy Lê Hoàng Nam', '0918445566', 'Dãy trọ gồm 18 phòng, có camera an ninh kết nối CSKV.', false),
(4, 'Giấy phép đủ điều kiện kinh doanh Gas/Khí đốt', 'Giấy phép kinh doanh có điều kiện', 'Đại lý Gas Hóc Môn', 'Số 204 Đường Phan Văn Hớn, Ấp Tiền Lân, Xã Bà Điểm', 'VALID', '2027-05-20', 'Đại úy Đỗ Hữu Nghĩa', '0987654321', 'Kho chứa gas tuân thủ khoảng cách an toàn chống cháy nổ.', false),
(5, 'Hồ sơ thẩm định an ninh cơ sở Game/Internet', 'Giấy phép kinh doanh', 'Cyber Game Bà Điểm', 'Số 15 Đường Bà Điểm 6, Ấp Đông Lân, Xã Bà Điểm', 'EXPIRED', '2026-08-30', 'Trung úy Phạm Đình Trọng', '0933778899', 'Đã hết hạn giấy chứng nhận, đã lập biên bản yêu cầu làm thủ tục cấp mới.', true),
(6, 'Sổ quản lý lưu trú & người nước ngoài', 'Sổ quản lý cư trú', 'Khách sạn Hoàng Long', 'Số 56 Đường Quốc Lộ 22, Ấp Hậu Lân, Xã Bà Điểm', 'VALID', '2027-12-31', 'Thượng úy Võ Minh Tuấn', '0944556677', 'Đã tích hợp phần mềm ASM khai báo lưu trú tự động qua VNeID.', false),
(7, 'Biên bản kiểm tra điều kiện an ninh cơ sở massage', 'Biên bản ANTT', 'Cơ sở Y học Cổ truyền Á Đông', 'Số 72 Đường Phan Văn Hớn, Ấp Bắc Lân, Xã Bà Điểm', 'EXPIRING_SOON', '2026-10-25', 'Đại úy Nguyễn Văn Bình', '0977223344', 'Nhân viên có chứng chỉ hành nghề và hợp đồng lao động đầy đủ.', false),
(8, 'Hồ sơ phòng ngừa tội phạm khu dân cư', 'Hồ sơ nghiệp vụ', 'Khu dân cư Tiền Lân 1', 'Đường Phan Văn Hớn, Ấp Tiền Lân, Xã Bà Điểm', 'VALID', '2027-06-30', 'Đại úy Đỗ Hữu Nghĩa', '0908678901', 'Tuyến đường có mô hình Tổ nhân dân tự quản kiểu mẫu về ANTT.', false);

-- 3. Seed patrol_log
DELETE FROM patrol_log;

INSERT INTO patrol_log (id, action, target, details, officer_name, badge_number, ip_address, timestamp)
VALUES
(1, 'Tuần tra an ninh trật tự ca đêm', 'Tuyến đường Phan Văn Hớn & Nguyễn Ảnh Thủ, Xã Bà Điểm', 'Phối hợp lực lượng bảo vệ an ninh trật tự cơ sở tuần tra khép kín địa bàn. Nhắc nhở 4 hộ dân để xe máy hớ hênh trước cửa nhà.', 'Đại úy Nguyễn Văn Bình', 'CSKV-0912', '192.168.1.45', '2026-09-27 22:30:00'),
(2, 'Kiểm tra hành chính cơ sở lưu trú', 'Nhà nghỉ Mai Vàng & Nhà trọ Hưng Lân, Ấp Bắc Lân', 'Kiểm tra việc đăng ký lưu trú trên phần mềm ASM. 100% khách lưu trú đã được quét CCCD gắn chip đối soát cơ sở dữ liệu quốc gia.', 'Đại úy Nguyễn Văn Bình', 'CSKV-0912', '192.168.1.45', '2026-09-27 15:45:00'),
(3, 'Giải tỏa trật tự lòng lề đường', 'Khu vực Chợ Bà Điểm, Đường Phan Văn Hớn, Ấp Tiền Lân', 'Tuyên truyền, vận động các hộ tiểu thương không lấn chiếm lòng lề đường làm nơi buôn bán, đảm bảo trật tự an toàn giao thông.', 'Đại úy Đỗ Hữu Nghĩa', 'CSKV-1045', '192.168.1.50', '2026-09-27 07:15:00'),
(4, 'Kiểm tra an toàn PCCC dãy nhà trọ', 'Khu nhà trọ 24 phòng, Hẻm 418, Ấp Nam Lân', 'Kiểm tra lối thoát hiểm thứ 2, kiểm tra hoạt động của 6 bình chữa cháy bột MFZ4. Nhắc nhở người thuê trọ sạc xe điện đúng khu vực quy định.', 'Thượng úy Trần Minh Tuấn', 'CSKV-0887', '192.168.1.48', '2026-09-26 16:20:00'),
(5, 'Tuyên truyền cảnh giác lừa đảo trên mạng', 'Hội trường Nhà Văn hóa Ấp Tây Lân, Xã Bà Điểm', 'Tổ chức buổi sinh hoạt chuyên đề phòng chống tội phạm công nghệ cao và hướng dẫn kích hoạt tài khoản định danh điện tử VNeID mức 2.', 'Đại úy Lê Hoàng Nam', 'CSKV-0734', '192.168.1.52', '2026-09-25 19:30:00');

-- 4. Seed security_alert
DELETE FROM security_alert;

INSERT INTO security_alert (id, alert_type, severity, title, description, location, is_resolved, reported_at, resolved_at)
VALUES
(1, 'CANH_BAO_AN_NINH', 'MEDIUM', 'Tụ tập nhóm thanh thiếu niên đêm khuya', 'Phát hiện nhóm 6 thanh thiếu niên điều khiển xe máy tụ tập nẹt pô tại đầu hẻm Đường Bà Điểm 4. Lực lượng tuần tra đã có mặt giải tán kịp thời.', 'Hẻm Đường Bà Điểm 4, Ấp Tây Lân, Xã Bà Điểm', true, '2026-09-27 01:15:00', '2026-09-27 01:40:00'),
(2, 'NHAC_NHO_CU_TRU', 'INFO', 'Cơ sở lưu trú chưa cập nhật thông tin khách nước ngoài', 'Nhà nghỉ Mai Vàng tiếp nhận 1 chuyên gia nước ngoài thuê phòng lúc 18h nhưng chưa đẩy dữ liệu lên hệ thống khai báo xuất nhập cảnh.', 'Số 45 Đường Phan Văn Hớn, Ấp Bắc Lân, Xã Bà Điểm', false, '2026-09-27 19:00:00', null),
(3, 'CANH_BAO_PCCC', 'CRITICAL', 'Vật cản che chắn lối thoát hiểm nhà xưởng', 'Phát hiện cơ sở may gia công tập kết thùng hàng bít lối cửa thoát nạn phía sau xưởng. Đã lập biên bản đình chỉ và yêu cầu di dời ngay.', 'Số 188 Đường Hưng Lân, Ấp Hậu Lân, Xã Bà Điểm', true, '2026-09-26 14:30:00', '2026-09-26 16:00:00'),
(4, 'CANH_BAO_TRAT_TU', 'MEDIUM', 'Hát karaoke loa kéo quá giờ quy định', 'Người dân phản ánh số nhà 92 Đường Bà Điểm 8 mở loa kéo âm lượng lớn sau 22h ảnh hưởng các hộ dân xung quanh. CSKV đã nhắc nhở và cam kết không tái phạm.', 'Số 92 Đường Bà Điểm 8, Ấp Đông Lân, Xã Bà Điểm', true, '2026-09-25 22:45:00', '2026-09-25 23:10:00');
