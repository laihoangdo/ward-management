import { test, expect } from '../fixtures';

for (const route of ['/dashboard', '/gis-dashboard']) {
  test(`E2E-AUTH-001 @smoke anonymous ${route} requires sign-in after reload`, async ({ page }) => {
    await page.goto(route);
    const login = page.getByRole('button', { name: 'Đăng nhập', exact: true });
    await expect(login).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Quản lý an ninh địa bàn', exact: true })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Về trang chủ', exact: true })).toBeVisible();
    await page.reload();
    await expect(login).toBeVisible();
    await page.getByRole('link', { name: 'Về trang chủ', exact: true }).click();
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole('button', { name: /Dashboard/ })).toBeVisible();
  });
}
