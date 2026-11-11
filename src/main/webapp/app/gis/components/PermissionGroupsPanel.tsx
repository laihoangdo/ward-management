import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Layers, Plus, Pencil, Trash2 } from 'lucide-react';
import type { PermissionGroup } from '../types';
import { deletePermissionGroup, fetchPermissionGroups, savePermissionGroup } from '../services/rbacApiService';
import { GROUP_ROLE_LABELS, PERMISSION_KEYS, PERMISSION_LABELS, type PermissionKey } from '../data/permissionCatalog';

interface Props {
  onShowToast: (message: string) => void;
}

const emptyGroup = (): PermissionGroup => ({ name: '', description: '', role: 'officer', ceiling: [], defaults: [] });

const errorDetail = (error: unknown) => {
  const detail = axios.isAxiosError(error) ? error.response?.data?.detail : undefined;
  return typeof detail === 'string' ? detail : error instanceof Error ? error.message : 'Không xác định';
};

/**
 * Super-admin editor for permission groups. A group is a ceiling: widening it grants nobody anything, narrowing it
 * revokes the removed permissions from members who hold them after an explicit confirmation.
 */
export const PermissionGroupsPanel: React.FC<Props> = ({ onShowToast }) => {
  const [groups, setGroups] = useState<PermissionGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<PermissionGroup | null>(null);
  const [pendingRevoke, setPendingRevoke] = useState<{ affected: number; permissions: string[] } | null>(null);
  const [saving, setSaving] = useState(false);

  const reload = () =>
    fetchPermissionGroups()
      .then(setGroups)
      .catch(() => onShowToast('Không tải được danh sách nhóm quyền.'))
      .finally(() => setLoading(false));
  useEffect(() => {
    void reload();
  }, []);

  const toggle = (field: 'ceiling' | 'defaults', key: PermissionKey) => {
    if (!editing) return;
    const has = editing[field].includes(key);
    const next = has ? editing[field].filter(k => k !== key) : [...editing[field], key];
    // A default outside the ceiling would be granted and then clipped; keep the two lists consistent.
    setEditing({
      ...editing,
      [field]: next,
      ...(field === 'ceiling' && has ? { defaults: editing.defaults.filter(k => k !== key) } : {}),
    });
    setPendingRevoke(null);
  };

  const save = async (confirmRevoke: boolean) => {
    if (!editing) return;
    setSaving(true);
    try {
      const result = await savePermissionGroup(editing, confirmRevoke);
      if (result.status === 'confirm') {
        setPendingRevoke({ affected: result.affected, permissions: result.permissions });
        return;
      }
      const revoked = result.group.revoked ?? 0;
      onShowToast(
        revoked > 0
          ? `Đã lưu nhóm "${result.group.name}" và thu hồi quyền của ${revoked} cán bộ.`
          : `Đã lưu nhóm "${result.group.name}". Quyền của cán bộ không thay đổi.`,
      );
      setEditing(null);
      setPendingRevoke(null);
      await reload();
    } catch (error) {
      onShowToast('Lỗi lưu nhóm quyền: ' + errorDetail(error));
    } finally {
      setSaving(false);
    }
  };

  const remove = async (group: PermissionGroup) => {
    if (!group.id || !window.confirm(`Xóa nhóm quyền "${group.name}"?`)) return;
    try {
      await deletePermissionGroup(group.id);
      onShowToast(`Đã xóa nhóm "${group.name}".`);
      await reload();
    } catch (error) {
      onShowToast('Không xóa được nhóm: ' + errorDetail(error));
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-5" id="permission-groups-panel">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <Layers className="w-5 h-5 text-emerald-400" aria-hidden="true" />
            Nhóm quyền (trần quyền)
          </h2>
          <p className="text-xs text-slate-400 mt-1 max-w-3xl">
            Nhóm quy định cán bộ <strong>được phép</strong> có những quyền nào và quyền mặc định khi tạo tài khoản. Quyền thật của từng
            người vẫn do cấp trên trực tiếp chọn: thêm quyền vào nhóm không tự cấp cho ai; bỏ quyền khỏi nhóm sẽ thu hồi sau khi bạn xác
            nhận.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setEditing(emptyGroup());
            setPendingRevoke(null);
          }}
          className="py-2 px-3.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold flex items-center gap-2"
        >
          <Plus className="w-3.5 h-3.5" aria-hidden="true" />
          Tạo nhóm quyền
        </button>
      </div>

      {loading ? (
        <p role="status" className="text-xs text-slate-400">
          Đang tải nhóm quyền...
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left text-slate-300">
            <thead className="text-slate-400">
              <tr>
                <th className="py-2 pr-3">Nhóm</th>
                <th className="py-2 pr-3">Vai trò</th>
                <th className="py-2 pr-3 tabular-nums">Được phép</th>
                <th className="py-2 pr-3 tabular-nums">Mặc định</th>
                <th className="py-2 pr-3 tabular-nums">Cán bộ</th>
                <th className="py-2" />
              </tr>
            </thead>
            <tbody>
              {groups.map(group => (
                <tr key={group.id} className="border-t border-slate-800">
                  <td className="py-2 pr-3">
                    <div className="font-semibold text-white">{group.name}</div>
                    {group.builtIn && <div className="text-[11px] text-slate-500">Nhóm gốc</div>}
                  </td>
                  <td className="py-2 pr-3">{GROUP_ROLE_LABELS[group.role]}</td>
                  <td className="py-2 pr-3 tabular-nums">{group.ceiling.length}/11</td>
                  <td className="py-2 pr-3 tabular-nums">{group.defaults.length}</td>
                  <td className="py-2 pr-3 tabular-nums">{group.members ?? 0}</td>
                  <td className="py-2 text-right whitespace-nowrap">
                    <button
                      type="button"
                      aria-label={`Sửa nhóm ${group.name}`}
                      onClick={() => {
                        setEditing({ ...group });
                        setPendingRevoke(null);
                      }}
                      className="p-2 rounded-lg text-slate-300 hover:bg-slate-800"
                    >
                      <Pencil className="w-3.5 h-3.5" aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      aria-label={`Xóa nhóm ${group.name}`}
                      disabled={!!group.builtIn || (group.members ?? 0) > 0}
                      title={
                        group.builtIn ? 'Không xóa nhóm gốc' : (group.members ?? 0) > 0 ? 'Chuyển hết cán bộ sang nhóm khác trước' : ''
                      }
                      onClick={() => void remove(group)}
                      className="p-2 rounded-lg text-rose-300 hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editing && (
        <form
          aria-label={editing.id ? `Sửa nhóm ${editing.name}` : 'Tạo nhóm quyền'}
          className="border border-slate-700 rounded-xl p-4 space-y-4"
          onSubmit={event => {
            event.preventDefault();
            void save(false);
          }}
        >
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
            <label className="block text-slate-300">
              Tên nhóm
              <input
                required
                maxLength={80}
                value={editing.name}
                onChange={e => setEditing({ ...editing, name: e.target.value })}
                className="mt-1 w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-white"
              />
            </label>
            <label className="block text-slate-300">
              Vai trò áp dụng
              <select
                value={editing.role}
                disabled={!!editing.builtIn || (editing.members ?? 0) > 0}
                onChange={e => setEditing({ ...editing, role: e.target.value as PermissionGroup['role'] })}
                className="mt-1 w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-white disabled:opacity-60"
              >
                {Object.entries(GROUP_ROLE_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-slate-300">
              Mô tả
              <input
                maxLength={300}
                value={editing.description}
                onChange={e => setEditing({ ...editing, description: e.target.value })}
                className="mt-1 w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-white"
              />
            </label>
          </div>

          <table className="w-full text-xs text-slate-300">
            <thead className="text-slate-400">
              <tr>
                <th className="py-1.5 text-left">Quyền</th>
                <th className="py-1.5 w-28">Được phép</th>
                <th className="py-1.5 w-28">Mặc định</th>
              </tr>
            </thead>
            <tbody>
              {PERMISSION_KEYS.map(key => {
                const allowed = editing.ceiling.includes(key);
                return (
                  <tr key={key} className="border-t border-slate-800">
                    <td className="py-1.5">{PERMISSION_LABELS[key]}</td>
                    <td className="py-1.5 text-center">
                      <input
                        type="checkbox"
                        aria-label={`Được phép: ${PERMISSION_LABELS[key]}`}
                        checked={allowed}
                        onChange={() => toggle('ceiling', key)}
                      />
                    </td>
                    <td className="py-1.5 text-center">
                      <input
                        type="checkbox"
                        aria-label={`Mặc định: ${PERMISSION_LABELS[key]}`}
                        checked={editing.defaults.includes(key)}
                        disabled={!allowed}
                        onChange={() => toggle('defaults', key)}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {pendingRevoke && (
            <div role="alert" className="rounded-lg border border-amber-500/60 bg-amber-950/40 p-3 text-xs text-amber-100 space-y-2">
              <p>
                <strong>{pendingRevoke.affected} cán bộ</strong> đang được cấp quyền sẽ bị thu hồi:{' '}
                {pendingRevoke.permissions.map(key => PERMISSION_LABELS[key as PermissionKey] ?? key).join(', ')}. Cấp trên của họ sẽ thấy
                quyền này ở trạng thái khóa.
              </p>
              <button
                type="button"
                disabled={saving}
                onClick={() => void save(true)}
                className="py-1.5 px-3 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-semibold disabled:opacity-60"
              >
                Xác nhận thu hồi và lưu
              </button>
            </div>
          )}

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                setEditing(null);
                setPendingRevoke(null);
              }}
              className="py-2 px-3.5 rounded-xl border border-slate-700 text-slate-300 text-xs"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={saving || !!pendingRevoke}
              className="py-2 px-3.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold disabled:opacity-60"
            >
              Lưu nhóm quyền
            </button>
          </div>
        </form>
      )}
    </div>
  );
};
