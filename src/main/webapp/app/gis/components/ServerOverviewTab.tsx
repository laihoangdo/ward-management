import React, { useEffect, useRef, useState } from 'react';
import { OverviewTab } from './OverviewTab';
import { fetchOverviewSummary, OverviewScope, OverviewSummary } from '../services/overviewApi';
import { loadHouseholdDetail } from '../services/householdBrowse';
import { HouseholdFacility, NavigationTab } from '../types';

interface Props {
  search: string;
  refreshKey: number;
  onScopeLoaded: (scope: OverviewScope) => void;
  onNavigateTab: (tab: NavigationTab) => void;
  canNavigate: (tab: NavigationTab) => boolean;
  onOpenExpiringDocuments: () => void;
  onSelectHousehold: (household: HouseholdFacility) => void;
}

export function ServerOverviewTab({ search, refreshKey, onScopeLoaded, ...props }: Props) {
  const [summary, setSummary] = useState<OverviewSummary>();
  const [page, setPage] = useState(1);
  const [size, setSize] = useState(10);
  const [retry, setRetry] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [detailLoading, setDetailLoading] = useState(false);
  const detailRequestRef = useRef<AbortController | null>(null);
  useEffect(() => () => detailRequestRef.current?.abort(), []);
  useEffect(() => {
    setPage(1);
  }, [search, size]);
  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(
      () => {
        setLoading(true);
        void fetchOverviewSummary(search, page - 1, size, controller.signal)
          .then(data => {
            if (controller.signal.aborted) return;
            setSummary(data);
            setPage(data.warningPage + 1);
            onScopeLoaded(data.scope);
            setError('');
          })
          .catch(() => {
            if (!controller.signal.aborted) setError('Chưa tải được tổng quan. Vui lòng thử lại.');
          })
          .finally(() => {
            if (!controller.signal.aborted) setLoading(false);
          });
      },
      search ? 250 : 0,
    );
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [search, page, size, refreshKey, retry, onScopeLoaded]);

  const select = async (household: HouseholdFacility) => {
    detailRequestRef.current?.abort();
    const controller = new AbortController();
    detailRequestRef.current = controller;
    setDetailLoading(true);
    try {
      const complete = await loadHouseholdDetail(household.id, controller.signal);
      if (!controller.signal.aborted) props.onSelectHousehold(complete);
    } catch {
      if (!controller.signal.aborted) setError('Chưa tải được hồ sơ hộ dân đầy đủ. Vui lòng chọn lại.');
    } finally {
      if (!controller.signal.aborted) setDetailLoading(false);
    }
  };
  return (
    <div aria-busy={loading || detailLoading}>
      {loading && <p role="status">Đang tải thống kê địa bàn…</p>}
      {detailLoading && <p role="status">Đang tải hồ sơ hộ dân…</p>}
      {error && (
        <div role="alert">
          {error} {summary && 'Kết quả bên dưới là lần tải trước.'}{' '}
          <button type="button" onClick={() => setRetry(value => value + 1)}>
            Thử lại
          </button>
        </div>
      )}
      {summary && (
        <OverviewTab
          {...props}
          onSelectHousehold={select}
          households={summary.previewItems}
          summary={summary}
          warningPagination={{ page, size, onPageChange: setPage, onPageSizeChange: setSize }}
        />
      )}
    </div>
  );
}
