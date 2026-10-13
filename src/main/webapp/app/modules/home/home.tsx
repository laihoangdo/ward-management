import './home.scss';

import React, { useEffect } from 'react';
import { Alert, Col, Row } from 'react-bootstrap';
import { useLocation, useNavigate } from 'react-router';

import { useAppSelector } from 'app/config/store';
import { REDIRECT_URL, getLoginUrl } from 'app/shared/util/url-utils';

export const Home = () => {
  const account = useAppSelector(state => state.authentication.account);
  const pageLocation = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const redirectURL = localStorage.getItem(REDIRECT_URL);
    if (redirectURL) {
      localStorage.removeItem(REDIRECT_URL);
      location.href = `${location.origin}${redirectURL}`;
    }
  });

  return (
    <Row>
      <Col md="3" className="pad">
        <span className="hipster rounded" />
      </Col>
      <Col md="9">
        <h1 className="h2">Quản lý địa bàn và dân cư</h1>
        <div
          className="p-4 mb-4 rounded-3 text-white shadow-sm"
          style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1e3a8a 50%, #1d4ed8 100%)' }}
        >
          <div className="d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-3">
            <div>
              <span className="badge bg-warning text-dark mb-2 fw-bold">HỆ THỐNG AN NINH ĐỊA BÀN</span>
              <h2 className="h3 fw-bold mb-1">Không gian làm việc địa bàn</h2>
              <p className="mb-0 text-light" style={{ opacity: 0.9 }}>
                Tra cứu hộ dân, nhân khẩu và hồ sơ; xem vị trí trên bản đồ và ghi nhận kiểm tra trong phạm vi được phân công.
              </p>
            </div>
            <button
              type="button"
              className="btn btn-warning fw-bold px-4 py-2 text-dark text-nowrap shadow"
              onClick={() => navigate('/dashboard')}
            >
              Mở không gian làm việc
            </button>
          </div>
        </div>

        {account?.login ? (
          <div>
            <Alert variant="success">Bạn đang đăng nhập bằng tài khoản &quot;{account.login}&quot;.</Alert>
          </div>
        ) : (
          <div>
            <Alert variant="warning">
              Đăng nhập bằng tài khoản được cấp để truy cập dữ liệu địa bàn.
              <button
                type="button"
                className="btn btn-primary d-block mt-3"
                onClick={() =>
                  navigate(getLoginUrl(), {
                    state: { from: pageLocation },
                  })
                }
              >
                Đăng nhập
              </button>
            </Alert>
          </div>
        )}
        <p>Nếu bạn có bất kỳ câu hỏi nào về Sunny Tech vui lòng truy cập:</p>

        <ul>
          <li>
            <a href="https://laihoangdo.github.io/sunny-tech-site" target="_blank" rel="noopener noreferrer">
              Trang chủ Sunny Tech
            </a>
          </li>
        </ul>
      </Col>
    </Row>
  );
};

export default Home;
