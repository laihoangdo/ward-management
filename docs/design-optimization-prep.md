# Chuẩn bị phase optimize design

Phase giao diện đã được triển khai theo yêu cầu người dùng. Xem `design-system/municipal-administration/MASTER.md` cho quy ước hiện tại và `docs/administration-design-validation.md` cho kết quả kiểm tra. Các mục bên dưới lưu lại thông tin cài đặt và ràng buộc ban đầu.

## Skill đã cài

- Nguồn: https://github.com/nextlevelbuilder/ui-ux-pro-max-skill
- CLI sử dụng: `ui-ux-pro-max-cli@2.15.0`.
- Cài đặt ở phạm vi người dùng, không thêm dependency vào ứng dụng:

```powershell
npx.cmd --yes ui-ux-pro-max-cli@2.15.0 init --ai universal --global
```

- Skill chính: `C:\Users\admin\.agents\skills\ui-ux-pro-max\SKILL.md`.
- OpenCode đã nhận diện và tải được skill `ui-ux-pro-max`. Bộ cài cũng cung cấp các skill liên quan về design, design-system, ui-styling, brand, banner và slides.
- Python có sẵn: `C:\Users\admin\AppData\Local\Python\pythoncore-3.14-64\python.exe` (3.14.7). Alias `python` trên PATH hiện trỏ WindowsApps; không cần cài thêm Python hoặc sửa PATH để dùng skill.
- Đã kiểm tra script tìm kiếm chạy offline với domain UX, trả đúng hướng dẫn Web về error summary và inline validation. Đây là kiểm tra công cụ, chưa chọn hay áp dụng thiết kế.

Ví dụ gọi công cụ trên máy hiện tại:

```powershell
& 'C:\Users\admin\AppData\Local\Python\pythoncore-3.14-64\python.exe' `
  'C:\Users\admin\.agents\skills\ui-ux-pro-max\scripts\search.py' `
  'error summary validation' --domain ux -n 1
```

## Khi bắt đầu tối ưu giao diện

### Skill bổ sung: Taste Skill

- Repo: https://github.com/Leonxlnx/taste-skill
- ID được OpenCode nhận diện: `design-taste-frontend`.
- Cài ở phạm vi người dùng, không thêm dependency vào ứng dụng:

```powershell
npx.cmd --yes skills add https://github.com/Leonxlnx/taste-skill --skill design-taste-frontend --global --agent opencode --yes
```

- Vị trí: `C:\Users\admin\.agents\skills\design-taste-frontend\SKILL.md`.
- Node v24.18.0 đáp ứng yêu cầu Node 22+; Chrome đã có trên máy. Đã kiểm tra cú pháp thành công cho 10 module Node của skill; chưa chạy draw/inspect hoặc tải ảnh.
- Bộ cài hiển thị đánh giá Gen Safe, Socket 1 alert và Snyk Med Risk. Đây là cảnh báo của công cụ bên ngoài, không phải kết luận đã kiểm toán an toàn; chỉ kiểm tra cú pháp không đủ chứng minh an toàn. Rà soát script và phạm vi trước khi thực thi.
- Khi gọi inspector sau này, dùng profile Chrome tạm riêng và đặt `TASTE_SKILL_TMP` về `C:\Users\admin\AppData\Local\Temp\opencode`. Không gắn vào trình duyệt cá nhân hoặc tự tải ảnh/tài nguyên mạng cho ứng dụng offline.
- Vai trò phối hợp: UI UX Pro Max hỗ trợ tra cứu UX/accessibility; Taste Skill bổ sung phê bình thị giác và kiểm tra screenshot. Với dashboard này phải đọc toàn bộ `references/app-screens.md`, giữ palette/type theo MASTER hiện có, không tự rút lại bộ style ngẫu nhiên hay áp dụng luật hero/video/animation của landing page.
- Quyền, dữ liệu, MapLibre/Three.js, giới hạn tầng và các tính năng nghiệp vụ luôn được ưu tiên hơn gợi ý thẩm mỹ của skill. Cài đặt này không thay đổi giao diện đã triển khai.

### Quy trình chung

1. Nạp skill `ui-ux-pro-max`, đọc lại `package.json`, component và hệ theme/token thực tế. Stack hiện tại gồm React, TypeScript, Tailwind, MapLibre và Three.js; không tự nâng phiên bản hay đổi thư viện icon.
2. Chốt phạm vi với người dùng: màn hình ưu tiên, phong cách, mật độ thông tin và light/dark mode. Chưa tự chọn theme hoặc sửa giao diện trong bước chuẩn bị này.
3. Tái sử dụng semantic tokens/hệ styling đang có. Nếu tạo design system, kiểm tra kết quả trước khi lưu MASTER và các page override.
4. Tối ưu từng nhóm component nhỏ; kiểm tra responsive, độ tương phản, focus bàn phím, label/ARIA, lỗi form, tiếng Việt có dấu và reduced motion.
5. Chạy regression test và kiểm tra trình duyệt sau mỗi đợt. Không đánh đổi hiệu năng bản đồ bằng blur, shadow hoặc animation nặng. Không cam kết 60 FPS nếu chưa đo trên GPU đích.

## Những thứ phải giữ nguyên

- Bản đồ MapLibre hiện tại, canvas/camera chung và nút bật/tắt hiệu ứng Three.js; không khôi phục hai viewer thử nghiệm đã xóa.
- Chọn công trình, bộ lọc/layer, vẽ và di chuyển nhà, sửa thuộc tính, liên kết hộ dân, chụp ảnh và toàn màn hình.
- Quyền thao tác, RBAC/phạm vi địa bàn, giới hạn 20 tầng / 70 m và cơ chế ưu tiên bản ghi API.
- GeoJSON dùng chung `src/main/webapp/content/data/badiem-houses.geojson`, ID/footprint và metadata nguồn giả lập; không đổi dữ liệu chỉ để trang trí.
- Tile vệ tinh/bản đồ offline; không tự thêm dịch vụ tile/font/analytics bên ngoài hoặc đưa dữ liệu dân cư vào câu truy vấn/dịch vụ thiết kế.

`AGENTS.md` trỏ đến tài liệu này để các phiên làm việc sau đọc lại được. Đây là ghi nhớ bằng file trong repo, không phải bảo đảm trí nhớ hội thoại vĩnh viễn.
