import React from 'react';
import { HouseholdFacility } from '../types';

interface Props {
  household: HouseholdFacility;
  onClose: () => void;
  onOpenProfile: () => void;
}

const STATUS_LABEL: Record<HouseholdFacility['status'], string> = {
  normal: 'Hộ dân cư bình thường',
  warning: 'Cảnh báo hết hạn',
  alert: 'Đối tượng chú ý ANTT',
  business: 'Cơ sở kinh doanh',
};

export default function MapLibreHouseholdPanel({ household, onClose, onOpenProfile }: Props) {
  const [lat, lng] = household.coordinates;

  return (
    <aside className="tc2-household-panel" aria-label="Thông tin địa bàn của hộ dân">
      <header className="tc2-household-panel-header">
        <h3>THÔNG TIN ĐỊA BÀN</h3>
        <span>{household.hamlet}</span>
        <button type="button" onClick={onClose} aria-label="Đóng thông tin hộ dân">
          ×
        </button>
      </header>
      <div className="tc2-household-panel-body">
        <h4>
          Số {household.houseNumber} {household.street}
        </h4>
        <div>⌖ {household.hamlet}</div>
        <small>
          Tọa độ: {lat.toFixed(5)}, {lng.toFixed(5)}
        </small>
        <span className={`tc2-household-status tc2-household-status--${household.status}`}>{STATUS_LABEL[household.status]}</span>

        {household.businessName && (
          <div className="tc2-household-panel-callout">
            <strong>{household.businessName}</strong>
            <span>Ngành nghề: {household.businessCategory || 'Chưa cập nhật'}</span>
          </div>
        )}
        {household.warningMessage && <div className="tc2-household-panel-callout">{household.warningMessage}</div>}

        <dl className="tc2-household-panel-facts">
          <div>
            <dt>Chủ hộ / Quản lý:</dt>
            <dd>{household.ownerName}</dd>
          </div>
          <div>
            <dt>Số điện thoại:</dt>
            <dd>{household.ownerPhone ? <a href={`tel:${household.ownerPhone}`}>{household.ownerPhone}</a> : 'Chưa cập nhật'}</dd>
          </div>
          <div>
            <dt>Tổng nhân khẩu:</dt>
            <dd>
              {household.residentsCount} người ({household.maleCount} Nam, {household.femaleCount} Nữ)
            </dd>
          </div>
          <div>
            <dt>Cơ cấu tuổi:</dt>
            <dd>
              {household.above18Count} người lớn, {household.under18Count} trẻ em
            </dd>
          </div>
        </dl>

        <div className="tc2-household-panel-notes">
          <strong>Ghi chú cán bộ phụ trách:</strong>
          <p>{household.notes || 'Chưa có ghi chú.'}</p>
          <div>
            <span>Kiểm tra gần nhất: {household.lastCheckedDate}</span>
            <span>Cán bộ: {household.officerInCharge}</span>
          </div>
        </div>

        <button type="button" className="tc2-household-panel-profile" onClick={onOpenProfile}>
          Xem đầy đủ hồ sơ &amp; cập nhật
        </button>
        {household.ownerPhone && (
          <a className="tc2-household-panel-phone" href={`tel:${household.ownerPhone}`}>
            Gọi điện trực tiếp ({household.ownerPhone})
          </a>
        )}
      </div>
    </aside>
  );
}
