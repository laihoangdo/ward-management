import React, { useEffect, useState } from 'react';
import { Navigate } from 'react-router';

import { REDIRECT_URL, safeRedirectPath } from 'app/shared/util/url-utils';

/**
 * The root URL is not a page of its own: after sign-in it honours the stored return path, otherwise it opens the
 * dashboard (which shows the sign-in card to anonymous visitors).
 */
export const Home = () => {
  const [stored] = useState(() => localStorage.getItem(REDIRECT_URL));

  useEffect(() => {
    if (stored !== null) {
      localStorage.removeItem(REDIRECT_URL);
      // A value saved by an older build (e.g. "/sunnytech.cloud/sign-in") must not strand the user on a refused URL.
      location.href = `${location.origin}${safeRedirectPath(stored) ?? '/dashboard'}`;
    }
  }, [stored]);

  if (stored !== null)
    return (
      <p role="status" className="p-3">
        Đang chuyển trang…
      </p>
    );
  return <Navigate to="/dashboard" replace />;
};

export default Home;
