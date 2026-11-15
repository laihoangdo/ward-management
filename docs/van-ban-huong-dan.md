# Văn bản hướng dẫn CSKV (GĐ5)

Màn hình **Văn bản hướng dẫn CSKV** (`?tab=guidance`, nhóm Công việc hằng ngày) là sổ theo dõi các văn bản hướng dẫn nghiệp vụ mà cảnh sát khu vực nhận được. Sổ dùng chung cho toàn xã, không chia theo ấp.

| Trường                                          | Cột `guidance_document`                | Ghi chú                                                        |
| ----------------------------------------------- | -------------------------------------- | -------------------------------------------------------------- |
| Số, ký hiệu                                     | `doc_number`                           | Bắt buộc                                                       |
| Cơ quan ban hành                                | `issuing_authority`                    | Bắt buộc                                                       |
| Ngày ban hành                                   | `issued_on`                            | Bắt buộc, không được ở tương lai                               |
| Trích yếu / tiêu đề                             | `title`                                | Bắt buộc                                                       |
| Ngày nhận                                       | `received_on`                          | Không được trước ngày ban hành; mặc định là hôm nay khi vào sổ |
| Lĩnh vực, nội dung chính cần thực hiện, ghi chú | `field`, `summary`, `notes`            | Không bắt buộc                                                 |
| Bản quét                                        | `attachment` với owner kind `GUIDANCE` | PDF ≤ 20 MB hoặc ảnh JPEG/PNG; tối đa 10 tệp                   |

- Không được vào sổ hai lần cùng một số, cơ quan ban hành và ngày ban hành.
- Sửa văn bản có kiểm tra `version`: nếu người khác đã sửa trước thì trả về 409.
- Danh sách tìm được theo số, trích yếu, cơ quan, lĩnh vực và nội dung; lọc được theo năm ban hành và theo cơ quan ban hành.

## API

- `GET /api/guidance-documents` (`search`, `year`, `authority`, `page`)
- `GET /api/guidance-documents/summary`
- `GET`, `PUT` và `DELETE /api/guidance-documents/{id}`; `POST /api/guidance-documents`
- Bản quét: `GET` và `POST /api/guidance-documents/{id}/files`, `GET …/files/{fileId}/content` (trả về với `sandbox` và `nosniff`), `DELETE …/files/{fileId}`

## Phân quyền

- **Xem:** mọi cán bộ đã đăng nhập.
- **Ghi:** cần quyền mới `canManageGuidanceDocs` để vào sổ, sửa, xoá và tải lên hoặc xoá bản quét. Preset Cán bộ quản lý ấp và Trưởng công an xã có sẵn quyền này; Công an viên thì không.
  - Các tài khoản đã có từ trước phải được cấp thêm quyền ở "Phân quyền Cán bộ & CAV".
- Mọi thao tác ghi đều được lưu vào `rbac_audit` (`guidance-create`, `guidance-update`, `guidance-delete`, `attachment-upload`, `attachment-delete`).

## Thay đổi chung

- `attachment.hamlet_id` giờ cho phép để trống, dành cho các tệp không thuộc ấp nào (như văn bản dùng chung toàn xã).
- `AttachmentRecords.add` nhận `Long hamlet`.
