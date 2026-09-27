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
        <h1 className="display-4">Chào mừng bạn đến với Sunny TECH</h1>
        <div
          className="p-4 mb-4 rounded-3 text-white shadow-sm"
          style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1e3a8a 50%, #1d4ed8 100%)' }}
        >
          <div className="d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-3">
            <div>
              <span className="badge bg-warning text-dark mb-2 fw-bold">HỆ THỐNG AN NINH ĐỊA BÀN</span>
              <h2 className="h3 fw-bold mb-1">Trung tâm Điều hành & Bản đồ GIS Số hóa</h2>
              <p className="mb-0 text-light" style={{ opacity: 0.9 }}>
                Bản đồ GIS tương tác, Heatmap an ninh trật tự, quản lý cơ sở kinh doanh có điều kiện, nhân khẩu, nhận diện OCR và tuần tra.
              </p>
            </div>
            <button
              type="button"
              className="btn btn-warning fw-bold px-4 py-2 text-dark text-nowrap shadow"
              onClick={() => navigate('/dashboard')}
            >
              Mở Bản Đồ & Dashboard ➔
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
              Nếu bạn muốn
              <span>&nbsp;</span>
              <a
                className="alert-link"
                onClick={() =>
                  navigate(getLoginUrl(), {
                    state: { from: pageLocation },
                  })
                }
              >
                đăng nhập
              </a>
              , bạn có thể thử với tài khoản mặc định:
              <br />- Quản trị viên (tài khoản=&quot;admin&quot; và mật khẩu=&quot;admin&quot;) <br />- Người dùng (tài
              khoản=&quot;user&quot; và mật khẩu=&quot;user&quot;).
            </Alert>
          </div>
        )}
        <p>Nếu bạn có bất kỳ câu hỏi nào về JHipster vui lòng truy cập:</p>

        <ul>
          <li>
            <a href="https://www.jhipster.tech/" target="_blank" rel="noopener noreferrer">
              Trang chủ JHipster
            </a>
          </li>
          <li>
            <a href="https://stackoverflow.com/tags/jhipster/info" target="_blank" rel="noopener noreferrer">
              JHipster trên Stack Overflow
            </a>
          </li>
          <li>
            <a href="https://github.com/jhipster/generator-jhipster/issues?state=open" target="_blank" rel="noopener noreferrer">
              Theo dõi các lỗi JHipster
            </a>
          </li>
          <li>
            <a href="https://gitter.im/jhipster/generator-jhipster" target="_blank" rel="noopener noreferrer">
              Phòng chat công cộng JHipster
            </a>
          </li>
          <li>
            <a href="https://twitter.com/jhipster" target="_blank" rel="noopener noreferrer">
              Theo dõi @jhipster trên Twitter
            </a>
          </li>
        </ul>

        <p>
          Nếu bạn thích JHipster, đừng quên cho chúng tôi thêm một ngôi sao trên{' '}
          <a href="https://github.com/jhipster/generator-jhipster" target="_blank" rel="noopener noreferrer">
            GitHub
          </a>
          !
        </p>
      </Col>
    </Row>
  );
};

export default Home;
