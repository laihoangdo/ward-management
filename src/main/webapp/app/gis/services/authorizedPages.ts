import axios from 'axios';

/** Keep full-data consumers complete, with at most two page requests per dataset. */
export async function fetchAuthorizedPages<T>(path: string): Promise<{ data: T[] }> {
  const size = 500;
  const read = async (page: number) => {
    const response = await axios.get<T[]>(path, { params: { page, size, sort: 'id,asc' } });
    if (!Array.isArray(response.data)) throw new Error('Dữ liệu máy chủ không hợp lệ');
    return response;
  };
  const first = await read(0);
  const data = [...first.data];
  if (first.data.length < size) return { data };
  const rawTotal = first.headers?.['x-total-count'];
  const total = typeof rawTotal === 'string' && /^\d+$/.test(rawTotal) ? Number(rawTotal) : NaN;
  const pages = Number.isSafeInteger(total) && total >= data.length ? Math.ceil(total / size) : 1;
  let page = 1;
  let lastLength = first.data.length;
  while (page < pages) {
    const batch = Array.from({ length: Math.min(2, pages - page) }, (_, index) => page + index);
    const responses = await Promise.all(batch.map(read));
    for (const response of responses) {
      data.push(...response.data);
      lastLength = response.data.length;
    }
    page += batch.length;
  }
  // Probe the tail when the total is absent, or a full last page may have grown.
  while (lastLength === size) {
    const response = await read(page++);
    data.push(...response.data);
    lastLength = response.data.length;
  }
  return { data };
}
