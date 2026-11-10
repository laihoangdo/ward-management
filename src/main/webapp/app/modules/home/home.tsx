import './home.scss';

import React, { useEffect } from 'react';
import { Alert, Col, Row } from 'react-bootstrap';
import { useLocation, useNavigate } from 'react-router';

import { useAppSelector } from 'app/config/store';
import { REDIRECT_URL, getLoginUrl, safeRedirectPath } from 'app/shared/util/url-utils';

export const Home = () => {
  const account = useAppSelector(state => state.authentication.account);
  const pageLocation = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const stored = localStorage.getItem(REDIRECT_URL);
    if (stored !== null) {
      localStorage.removeItem(REDIRECT_URL);
      // A value saved by an older build (e.g. "/sunnytech.cloud/sign-in") must not strand the user on a refused URL.
      location.href = `${location.origin}${safeRedirectPath(stored) ?? '/dashboard'}`;
    }
  });

  return (
    <Row>
      <Col lg="10" className="mx-auto">
        <h1 className="h2">Quản lý địa bàn và dân cư</h1>
        <div className="p-4 mb-4 rounded-3 text-white" style={{ background: '#122e35' }}>
          <div className="d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-3">
            <div>
              <p className="small mb-2 text-light">Hệ thống an ninh địa bàn</p>
              <h2 className="h3 fw-bold mb-1">Không gian làm việc địa bàn</h2>
              <p className="mb-0 text-light" style={{ opacity: 0.9 }}>
                Tra cứu hộ dân, nhân khẩu và hồ sơ; xem vị trí trên bản đồ và ghi nhận kiểm tra trong phạm vi được phân công.
              </p>
            </div>
            <button type="button" className="btn btn-light fw-bold px-4 py-2 text-dark text-nowrap" onClick={() => navigate('/dashboard')}>
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
