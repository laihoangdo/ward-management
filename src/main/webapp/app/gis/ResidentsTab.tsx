import React, { useState, useMemo } from 'react';
import {
  Users,
  UserCheck,
  UserPlus,
  Search,
  Filter,
  Eye,
  Edit,
  Trash2,
  Phone,
  Shield,
  ShieldAlert,
  AlertTriangle,
  CheckCircle2,
  Building2,
  MapPin,
  Calendar,
  CreditCard,
  X,
  PieChart,
  BarChart3,
  Home,
  ArrowRight,
  RotateCcw,
  FileSpreadsheet,
  LayoutGrid,
  List,
  Info,
  ChevronRight,
} from 'lucide-react';
import { HouseholdFacility, Resident, ResidenceType, AppUser } from './types';
import { getEffectiveResidentsList } from './utils/residentRosterUtils';

export interface ResidentRecord extends Resident {
  householdId: string;
  householdCode: string;
  houseNumber: string;
  street: string;
  hamlet: string;
  neighborhoodGroup?: string;
  alley?: string;
  ownerName: string;
  ownerPhone: string;
  householdType: string;
}

interface ResidentsTabProps {
  households: HouseholdFacility[];
  allHouseholds?: HouseholdFacility[];
  onSelectHousehold: (household: HouseholdFacility) => void;
  onUpdateHousehold: (updated: HouseholdFacility) => void;
  currentUser?: AppUser | null;
  onShowToast?: (msg: string) => void;
}

export const ResidentsTab: React.FC<ResidentsTabProps> = ({
  households,
  allHouseholds,
  onSelectHousehold,
  onUpdateHousehold,
  currentUser,
  onShowToast,
}) => {
  // Filters & State
  const [searchTerm, setSearchTerm] = useState('');
  const [residenceFilter, setResidenceFilter] = useState<'all' | ResidenceType>('all');
  const [genderFilter, setGenderFilter] = useState<'all' | 'Nam' | 'Nữ'>('all');
  const [securityFilter, setSecurityFilter] = useState<'all' | 'monitored' | 'normal'>('all');
  const [hamletFilter, setHamletFilter] = useState<string>('all');
  const [neighborhoodFilter, setNeighborhoodFilter] = useState<string>('all');
  const [ageGroupFilter, setAgeGroupFilter] = useState<'all' | 'under18' | 'labor' | 'elderly'>('all');
  const [viewMode, setViewMode] = useState<'table' | 'grid'>('table');

  // Modals
  const [selectedResident, setSelectedResident] = useState<ResidentRecord | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [residentToEdit, setResidentToEdit] = useState<ResidentRecord | null>(null);
  const [residentToDelete, setResidentToDelete] = useState<ResidentRecord | null>(null);
  const [isDemographicModalOpen, setIsDemographicModalOpen] = useState(false);

  // Form State for Adding / Editing
  const [formHouseholdId, setFormHouseholdId] = useState('');
  const [formFullName, setFormFullName] = useState('');
  const [formBirthYear, setFormBirthYear] = useState<number>(1995);
  const [formGender, setFormGender] = useState<'Nam' | 'Nữ'>('Nam');
  const [formRelationship, setFormRelationship] = useState('Chủ hộ');
  const [formIdCardNumber, setFormIdCardNumber] = useState('');
  const [formResidenceType, setFormResidenceType] = useState<ResidenceType>('Thường trú');
  const [formIsMonitored, setFormIsMonitored] = useState(false);
  const [formPhone, setFormPhone] = useState('');
  const [formOccupation, setFormOccupation] = useState('');
  const [formEthnicity, setFormEthnicity] = useState('Kinh');
  const [formNotes, setFormNotes] = useState('');

  const currentYear = 2026;
  const effectiveHouseholds = allHouseholds && allHouseholds.length > 0 ? allHouseholds : households;

  // Extract all residents flattened from households with unified effective list for all households
  const allResidents: ResidentRecord[] = useMemo(() => {
    const list: ResidentRecord[] = [];

    effectiveHouseholds.forEach(h => {
      const residents = getEffectiveResidentsList(h);
      residents.forEach(r => {
        list.push({
          ...r,
          householdId: h.id,
          householdCode: h.code,
          houseNumber: h.houseNumber,
          street: h.street,
          hamlet: h.hamlet,
          neighborhoodGroup: h.neighborhoodGroup,
          alley: h.alley,
          ownerName: h.ownerName,
          ownerPhone: h.ownerPhone,
          householdType: h.type,
        });
      });
    });

    return list;
  }, [effectiveHouseholds]);

  // Extract unique neighborhood groups
  const neighborhoodGroups = useMemo(() => {
    const set = new Set<string>();
    effectiveHouseholds.forEach(h => {
      if (h.neighborhoodGroup) set.add(h.neighborhoodGroup);
    });
    return Array.from(set).sort();
  }, [effectiveHouseholds]);

  // Extract unique hamlets
  const hamletList = useMemo(() => {
    const set = new Set<string>();
    effectiveHouseholds.forEach(h => {
      if (h.hamlet) set.add(h.hamlet);
    });
    return Array.from(set).sort();
  }, [effectiveHouseholds]);

  // Filtered residents list
  const filteredResidents = useMemo(() => {
    return allResidents.filter(r => {
      // Hamlet filter
      if (hamletFilter !== 'all' && r.hamlet !== hamletFilter) return false;

      // Neighborhood group filter
      if (neighborhoodFilter !== 'all' && r.neighborhoodGroup !== neighborhoodFilter) return false;

      // Residence Type
      if (residenceFilter !== 'all' && r.residenceType !== residenceFilter) return false;

      // Gender
      if (genderFilter !== 'all' && r.gender !== genderFilter) return false;

      // Security status
      if (securityFilter === 'monitored' && !r.isMonitored) return false;
      if (securityFilter === 'normal' && r.isMonitored) return false;

      // Age bracket
      const age = currentYear - r.birthYear;
      if (ageGroupFilter === 'under18' && age >= 18) return false;
      if (ageGroupFilter === 'labor' && (age < 18 || age > 60)) return false;
      if (ageGroupFilter === 'elderly' && age <= 60) return false;

      // Search term
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase().trim();
        const matchName = r.fullName ? r.fullName.toLowerCase().includes(q) : false;
        const matchId = r.idCardNumber ? r.idCardNumber.toLowerCase().includes(q) : false;
        const matchPhone = r.phone ? r.phone.includes(q) : false;
        const matchOwnerPhone = r.ownerPhone ? r.ownerPhone.includes(q) : false;
        const matchHouse = r.houseNumber ? r.houseNumber.toLowerCase().includes(q) : false;
        const matchStreet = r.street ? r.street.toLowerCase().includes(q) : false;
        const matchOwner = r.ownerName ? r.ownerName.toLowerCase().includes(q) : false;
        const matchRel = r.relationship ? r.relationship.toLowerCase().includes(q) : false;
        const matchJob = r.occupation ? r.occupation.toLowerCase().includes(q) : false;
        const matchCode = r.householdCode ? r.householdCode.toLowerCase().includes(q) : false;

        if (
          !matchName &&
          !matchId &&
          !matchPhone &&
          !matchOwnerPhone &&
          !matchHouse &&
          !matchStreet &&
          !matchOwner &&
          !matchRel &&
          !matchJob &&
          !matchCode
        ) {
          return false;
        }
      }

      return true;
    });
  }, [allResidents, searchTerm, residenceFilter, genderFilter, securityFilter, hamletFilter, neighborhoodFilter, ageGroupFilter]);

  // Overall Statistics
  const totalCount = allResidents.length;
  const thuongTruCount = allResidents.filter(r => r.residenceType === 'Thường trú').length;
  const tamTruCount = allResidents.filter(r => r.residenceType === 'Tạm trú').length;
  const luuTruCount = allResidents.filter(r => r.residenceType === 'Lưu trú').length;
  const monitoredCount = allResidents.filter(r => r.isMonitored).length;
  const maleCount = allResidents.filter(r => r.gender === 'Nam').length;
  const femaleCount = allResidents.filter(r => r.gender === 'Nữ').length;
  const under18Count = allResidents.filter(r => currentYear - r.birthYear < 18).length;
  const laborCount = allResidents.filter(r => {
    const age = currentYear - r.birthYear;
    return age >= 18 && age <= 60;
  }).length;
  const elderlyCount = allResidents.filter(r => currentYear - r.birthYear > 60).length;

  const isAnyFilterActive =
    searchTerm.trim() !== '' ||
    residenceFilter !== 'all' ||
    genderFilter !== 'all' ||
    securityFilter !== 'all' ||
    hamletFilter !== 'all' ||
    neighborhoodFilter !== 'all' ||
    ageGroupFilter !== 'all';

  const handleResetFilters = () => {
    setSearchTerm('');
    setResidenceFilter('all');
    setGenderFilter('all');
    setSecurityFilter('all');
    setHamletFilter('all');
    setNeighborhoodFilter('all');
    setAgeGroupFilter('all');
  };

  // Export CSV Handler
  const handleExportCSV = () => {
    if (currentUser?.role === 'officer' && currentUser?.subAdminPermissions?.canExportReports === false) {
      const msg = '⚠️ Thẩm quyền bị khóa: Bạn chưa được phân quyền xuất báo cáo danh sách CSV/Excel.';
      if (onShowToast) onShowToast(msg);
      else alert(msg);
      return;
    }

    const headers = [
      'STT',
      'Họ và Tên',
      'Năm Sinh',
      'Tuổi',
      'Giới Tính',
      'Số CCCD/Định Danh',
      'Loại Cư Trú',
      'Quan Hệ Với Chủ Hộ',
      'Số Nhà',
      'Tuyến Đường',
      'Tổ Dân Phố',
      'Khu Vực (Ấp)',
      'Tên Chủ Hộ',
      'SĐT Liên Hệ',
      'Nghề Nghiệp',
      'Đối Tượng Theo Dõi ANTT',
      'Ghi Chú',
    ];

    const rows = filteredResidents.map((r, index) => [
      index + 1,
      `"${r.fullName}"`,
      r.birthYear,
      currentYear - r.birthYear,
      `"${r.gender}"`,
      r.idCardNumber ? `"'${r.idCardNumber}"` : 'Chưa có',
      `"${r.residenceType}"`,
      `"${r.relationship}"`,
      `"${r.houseNumber}"`,
      `"${r.street}"`,
      `"${r.neighborhoodGroup || ''}"`,
      `"${r.hamlet}"`,
      `"${r.ownerName}"`,
      `"${r.phone || r.ownerPhone || ''}"`,
      `"${r.occupation || 'Tự do'}"`,
      r.isMonitored ? 'CẦN CHÚ Ý ANTT' : 'Bình thường',
      `"${(r.notes || '').replace(/"/g, '""')}"`,
    ]);

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(row => row.join(','))].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `Danh_sach_nhan_khau_P_An_Lac_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    if (onShowToast) {
      onShowToast(`Đã xuất báo cáo danh sách ${filteredResidents.length} nhân khẩu ra file Excel (CSV)!`);
    }
  };

  // Open Add Resident Modal
  const handleOpenAddModal = () => {
    if (effectiveHouseholds.length === 0) {
      alert('Chưa có danh sách hộ dân trên hệ thống.');
      return;
    }
    setFormHouseholdId(effectiveHouseholds[0].id);
    setFormFullName('');
    setFormBirthYear(1995);
    setFormGender('Nam');
    setFormRelationship('Con');
    setFormIdCardNumber('');
    setFormResidenceType('Thường trú');
    setFormIsMonitored(false);
    setFormPhone('');
    setFormOccupation('');
    setFormEthnicity('Kinh');
    setFormNotes('');
    setIsAddModalOpen(true);
  };

  // Submit Add Resident
  const handleSaveAddResident = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formFullName.trim()) {
      alert('Vui lòng nhập họ và tên nhân khẩu.');
      return;
    }
    if (!formHouseholdId) {
      alert('Vui lòng chọn hộ dân tiếp nhận.');
      return;
    }

    const targetH = effectiveHouseholds.find(h => h.id === formHouseholdId);
    if (!targetH) {
      alert('Không tìm thấy hộ dân đã chọn.');
      return;
    }

    const newResident: Resident = {
      id: `res-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      fullName: formFullName.trim(),
      birthYear: Number(formBirthYear) || 1995,
      gender: formGender,
      relationship: formRelationship.trim() || 'Thành viên',
      idCardNumber: formIdCardNumber.trim() || undefined,
      residenceType: formResidenceType,
      isMonitored: formIsMonitored,
      phone: formPhone.trim() || undefined,
      occupation: formOccupation.trim() || undefined,
      ethnicity: formEthnicity.trim() || 'Kinh',
      notes: formNotes.trim() || undefined,
      startDate: new Date().toLocaleDateString('vi-VN'),
    };

    // Calculate updated household residents and demographics
    const existingList = targetH.residentsList || [];
    const updatedResidentsList = [...existingList, newResident];

    const age = currentYear - newResident.birthYear;
    const isUnder18 = age < 18;

    const updatedHousehold: HouseholdFacility = {
      ...targetH,
      residentsList: updatedResidentsList,
      residentsCount: (targetH.residentsCount || existingList.length) + 1,
      maleCount: (targetH.maleCount || 0) + (newResident.gender === 'Nam' ? 1 : 0),
      femaleCount: (targetH.femaleCount || 0) + (newResident.gender === 'Nữ' ? 1 : 0),
      under18Count: (targetH.under18Count || 0) + (isUnder18 ? 1 : 0),
      above18Count: (targetH.above18Count || 0) + (isUnder18 ? 0 : 1),
    };

    onUpdateHousehold(updatedHousehold);
    setIsAddModalOpen(false);

    if (onShowToast) {
      onShowToast(`Đã đăng ký thêm nhân khẩu ${newResident.fullName} vào hộ ${targetH.code} (${targetH.houseNumber} ${targetH.street})`);
    }
  };

  // Open Edit Resident Modal
  const handleOpenEditModal = (r: ResidentRecord) => {
    setResidentToEdit(r);
    setFormHouseholdId(r.householdId);
    setFormFullName(r.fullName);
    setFormBirthYear(r.birthYear);
    setFormGender(r.gender);
    setFormRelationship(r.relationship);
    setFormIdCardNumber(r.idCardNumber || '');
    setFormResidenceType(r.residenceType);
    setFormIsMonitored(!!r.isMonitored);
    setFormPhone(r.phone || '');
    setFormOccupation(r.occupation || '');
    setFormEthnicity(r.ethnicity || 'Kinh');
    setFormNotes(r.notes || '');
    setIsEditModalOpen(true);
  };

  // Submit Edit Resident
  const handleSaveEditResident = (e: React.FormEvent) => {
    e.preventDefault();
    if (!residentToEdit) return;
    if (!formFullName.trim()) {
      alert('Vui lòng nhập họ và tên.');
      return;
    }

    const currentH = effectiveHouseholds.find(h => h.id === residentToEdit.householdId);
    if (!currentH) return;

    const updatedResidentData: Resident = {
      ...residentToEdit,
      fullName: formFullName.trim(),
      birthYear: Number(formBirthYear) || 1995,
      gender: formGender,
      relationship: formRelationship.trim(),
      idCardNumber: formIdCardNumber.trim() || undefined,
      residenceType: formResidenceType,
      isMonitored: formIsMonitored,
      phone: formPhone.trim() || undefined,
      occupation: formOccupation.trim() || undefined,
      ethnicity: formEthnicity.trim() || 'Kinh',
      notes: formNotes.trim() || undefined,
    };

    // If staying in same household
    if (formHouseholdId === residentToEdit.householdId) {
      const list = currentH.residentsList || [];
      const updatedList = list.some(item => item.id === residentToEdit.id)
        ? list.map(item => (item.id === residentToEdit.id ? updatedResidentData : item))
        : [...list, updatedResidentData];

      // Recalculate demographic counts
      const maleC = updatedList.filter(x => x.gender === 'Nam').length;
      const femaleC = updatedList.filter(x => x.gender === 'Nữ').length;
      const under18C = updatedList.filter(x => currentYear - x.birthYear < 18).length;
      const above18C = updatedList.length - under18C;

      const updatedHousehold: HouseholdFacility = {
        ...currentH,
        residentsList: updatedList,
        residentsCount: updatedList.length,
        maleCount: maleC,
        femaleCount: femaleC,
        under18Count: under18C,
        above18Count: above18C,
      };

      onUpdateHousehold(updatedHousehold);
    } else {
      // Moved to different household
      const targetH = effectiveHouseholds.find(h => h.id === formHouseholdId);
      if (targetH) {
        // Remove from current household
        const oldList = (currentH.residentsList || []).filter(x => x.id !== residentToEdit.id);
        const oldH: HouseholdFacility = {
          ...currentH,
          residentsList: oldList,
          residentsCount: Math.max(0, (currentH.residentsCount || 1) - 1),
          maleCount: oldList.filter(x => x.gender === 'Nam').length,
          femaleCount: oldList.filter(x => x.gender === 'Nữ').length,
          under18Count: oldList.filter(x => currentYear - x.birthYear < 18).length,
          above18Count: oldList.filter(x => currentYear - x.birthYear >= 18).length,
        };
        onUpdateHousehold(oldH);

        // Add to new household
        const newList = [...(targetH.residentsList || []), updatedResidentData];
        const newH: HouseholdFacility = {
          ...targetH,
          residentsList: newList,
          residentsCount: (targetH.residentsCount || 0) + 1,
          maleCount: newList.filter(x => x.gender === 'Nam').length,
          femaleCount: newList.filter(x => x.gender === 'Nữ').length,
          under18Count: newList.filter(x => currentYear - x.birthYear < 18).length,
          above18Count: newList.filter(x => currentYear - x.birthYear >= 18).length,
        };
        onUpdateHousehold(newH);
      }
    }

    setIsEditModalOpen(false);
    setResidentToEdit(null);
    if (onShowToast) {
      onShowToast(`Đã cập nhật hồ sơ nhân khẩu ${updatedResidentData.fullName}!`);
    }
  };

  // Delete Resident
  const handleConfirmDelete = () => {
    if (!residentToDelete) return;
    const currentH = effectiveHouseholds.find(h => h.id === residentToDelete.householdId);
    if (!currentH) {
      setResidentToDelete(null);
      return;
    }

    const updatedList = (currentH.residentsList || []).filter(r => r.id !== residentToDelete.id);
    const updatedH: HouseholdFacility = {
      ...currentH,
      residentsList: updatedList,
      residentsCount: Math.max(0, (currentH.residentsCount || 1) - 1),
      maleCount: updatedList.filter(x => x.gender === 'Nam').length,
      femaleCount: updatedList.filter(x => x.gender === 'Nữ').length,
      under18Count: updatedList.filter(x => currentYear - x.birthYear < 18).length,
      above18Count: updatedList.filter(x => currentYear - x.birthYear >= 18).length,
    };

    onUpdateHousehold(updatedH);
    setResidentToDelete(null);
    if (onShowToast) {
      onShowToast(`Đã xóa nhân khẩu ${residentToDelete.fullName} khỏi hộ ${currentH.code}.`);
    }
  };

  // Helper Badge Color for Residence Type
  const getResidenceBadge = (type: ResidenceType) => {
    switch (type) {
      case 'Thường trú':
        return {
          bg: 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800',
          dot: 'bg-emerald-500',
        };
      case 'Tạm trú':
        return {
          bg: 'bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800',
          dot: 'bg-blue-500',
        };
      case 'Lưu trú':
        return {
          bg: 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800',
          dot: 'bg-amber-500',
        };
      default:
        return {
          bg: 'bg-slate-50 text-slate-700 border-slate-200',
          dot: 'bg-slate-500',
        };
    }
  };

  return (
    <div id="residents-management-tab" className="space-y-5">
      {/* Top Banner / Title */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 sm:p-6 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="w-12 h-12 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-md shadow-blue-600/20 shrink-0">
              <UserCheck className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white tracking-tight">
                  Quản Lý Nhân Khẩu & Định Danh Điện Tử
                </h1>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-100 dark:bg-blue-900/60 text-blue-800 dark:text-blue-200 border border-blue-200 dark:border-blue-700">
                  {filteredResidents.length} / {totalCount} nhân khẩu
                </span>
              </div>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1 max-w-3xl">
                Cơ sở dữ liệu quản lý cư trú, kiểm tra thẻ CCCD/VNeID, phân loại thường trú, tạm trú, lưu trú và đối tượng nghiệp vụ an ninh
                trật tự trên địa bàn quản lý.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            <button
              type="button"
              id="btn-open-demographic-analysis"
              onClick={() => setIsDemographicModalOpen(true)}
              className="px-3 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer border border-slate-200 dark:border-slate-700"
            >
              <PieChart className="w-4 h-4 text-slate-500" />
              <span>Phân tích cơ cấu</span>
            </button>

            <button
              type="button"
              id="btn-export-residents-csv"
              onClick={handleExportCSV}
              className="px-3 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer border border-slate-200 dark:border-slate-700"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
              <span>Xuất CSV</span>
            </button>

            <button
              type="button"
              id="btn-add-resident"
              onClick={handleOpenAddModal}
              className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold shadow-sm transition flex items-center gap-1.5 cursor-pointer"
            >
              <UserPlus className="w-4 h-4" />
              <span>Đăng ký nhân khẩu</span>
            </button>
          </div>
        </div>

        {/* Dynamic Key Metric Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mt-5 pt-5 border-t border-slate-100 dark:border-slate-800">
          <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-750">
            <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400">Tổng nhân khẩu</div>
            <div className="text-xl font-bold text-slate-800 dark:text-white mt-0.5">{totalCount}</div>
            <div className="text-[10px] text-slate-500 mt-1 flex items-center gap-1.5">
              <span>Nam: {maleCount}</span>
              <span>•</span>
              <span>Nữ: {femaleCount}</span>
            </div>
          </div>

          <div className="p-3 bg-emerald-50/70 dark:bg-emerald-950/30 rounded-xl border border-emerald-200 dark:border-emerald-900/50">
            <div className="text-[11px] font-medium text-emerald-800 dark:text-emerald-300">Thường trú (HK)</div>
            <div className="text-xl font-bold text-emerald-700 dark:text-emerald-300 mt-0.5">{thuongTruCount}</div>
            <div className="text-[10px] text-emerald-600 dark:text-emerald-400 mt-1">
              Chiếm {totalCount > 0 ? Math.round((thuongTruCount / totalCount) * 100) : 0}% tổng dân số
            </div>
          </div>

          <div className="p-3 bg-blue-50/70 dark:bg-blue-950/30 rounded-xl border border-blue-200 dark:border-blue-900/50">
            <div className="text-[11px] font-medium text-blue-800 dark:text-blue-300">Tạm trú (KT3/Trọ)</div>
            <div className="text-xl font-bold text-blue-700 dark:text-blue-300 mt-0.5">{tamTruCount}</div>
            <div className="text-[10px] text-blue-600 dark:text-blue-400 mt-1">
              Chiếm {totalCount > 0 ? Math.round((tamTruCount / totalCount) * 100) : 0}% tổng dân số
            </div>
          </div>

          <div className="p-3 bg-amber-50/70 dark:bg-amber-950/30 rounded-xl border border-amber-200 dark:border-amber-900/50">
            <div className="text-[11px] font-medium text-amber-800 dark:text-amber-300">Lưu trú ngắn hạn</div>
            <div className="text-xl font-bold text-amber-700 dark:text-amber-300 mt-0.5">{luuTruCount}</div>
            <div className="text-[10px] text-amber-600 dark:text-amber-400 mt-1">Khách sạn / Nhà nghỉ</div>
          </div>

          <div className="p-3 bg-rose-50/70 dark:bg-rose-950/30 rounded-xl border border-rose-200 dark:border-rose-900/50">
            <div className="text-[11px] font-medium text-rose-800 dark:text-rose-300 flex items-center gap-1">
              <ShieldAlert className="w-3 h-3 text-rose-600" />
              Chú ý ANTT
            </div>
            <div className="text-xl font-bold text-rose-700 dark:text-rose-300 mt-0.5">{monitoredCount}</div>
            <div className="text-[10px] text-rose-600 dark:text-rose-400 mt-1">Quản lý nghiệp vụ CSKV</div>
          </div>

          <div className="p-3 bg-indigo-50/70 dark:bg-indigo-950/30 rounded-xl border border-indigo-200 dark:border-indigo-900/50">
            <div className="text-[11px] font-medium text-indigo-800 dark:text-indigo-300">Độ tuổi lao động</div>
            <div className="text-xl font-bold text-indigo-700 dark:text-indigo-300 mt-0.5">{laborCount}</div>
            <div className="text-[10px] text-indigo-600 dark:text-indigo-400 mt-1">
              Dưới 18: {under18Count} • Trên 60: {elderlyCount}
            </div>
          </div>
        </div>
      </div>

      {/* Filter and Search Toolbar */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-xs space-y-3.5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Main Search Input */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              id="input-search-residents"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder="Tìm theo họ tên, CCCD/VNeID, SĐT, số nhà, tên đường, tên chủ hộ, nghề nghiệp..."
              className="w-full pl-9 pr-8 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs sm:text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-blue-500 transition"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* View Mode & Reset Controls */}
          <div className="flex items-center gap-2 self-end md:self-auto">
            {isAnyFilterActive && (
              <button
                type="button"
                id="btn-reset-resident-filters"
                onClick={handleResetFilters}
                className="px-2.5 py-1.5 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 rounded-lg text-xs font-semibold flex items-center gap-1 transition cursor-pointer border border-rose-200 dark:border-rose-900"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Xóa lọc</span>
              </button>
            )}

            <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg border border-slate-200 dark:border-slate-700">
              <button
                type="button"
                id="btn-view-mode-table"
                onClick={() => setViewMode('table')}
                className={`p-1.5 rounded-md transition ${
                  viewMode === 'table'
                    ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-300 shadow-xs'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
                title="Xem dạng bảng"
              >
                <List className="w-4 h-4" />
              </button>
              <button
                type="button"
                id="btn-view-mode-grid"
                onClick={() => setViewMode('grid')}
                className={`p-1.5 rounded-md transition ${
                  viewMode === 'grid'
                    ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-300 shadow-xs'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
                title="Xem dạng thẻ định danh"
              >
                <LayoutGrid className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Detailed Dropdown Filters */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 pt-2 border-t border-slate-100 dark:border-slate-800">
          {/* Residence Type */}
          <div>
            <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Cư Trú</label>
            <select
              id="filter-residence-type"
              value={residenceFilter}
              onChange={e => setResidenceFilter(e.target.value as any)}
              className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs text-slate-800 dark:text-slate-200 focus:outline-hidden"
            >
              <option value="all">Tất cả cư trú</option>
              <option value="Thường trú">Thường trú ({thuongTruCount})</option>
              <option value="Tạm trú">Tạm trú ({tamTruCount})</option>
              <option value="Lưu trú">Lưu trú ({luuTruCount})</option>
            </select>
          </div>

          {/* Gender */}
          <div>
            <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Giới Tính</label>
            <select
              id="filter-resident-gender"
              value={genderFilter}
              onChange={e => setGenderFilter(e.target.value as any)}
              className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs text-slate-800 dark:text-slate-200 focus:outline-hidden"
            >
              <option value="all">Tất cả giới tính</option>
              <option value="Nam">Nam ({maleCount})</option>
              <option value="Nữ">Nữ ({femaleCount})</option>
            </select>
          </div>

          {/* Security Monitoring */}
          <div>
            <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Diện ANTT</label>
            <select
              id="filter-resident-security"
              value={securityFilter}
              onChange={e => setSecurityFilter(e.target.value as any)}
              className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs text-slate-800 dark:text-slate-200 focus:outline-hidden"
            >
              <option value="all">Tất cả diện</option>
              <option value="monitored">Cần chú ý ANTT ({monitoredCount})</option>
              <option value="normal">Bình thường ({totalCount - monitoredCount})</option>
            </select>
          </div>

          {/* Hamlet */}
          <div>
            <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Khu Vực (Ấp)</label>
            <select
              id="filter-resident-hamlet"
              value={hamletFilter}
              onChange={e => setHamletFilter(e.target.value)}
              className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs text-slate-800 dark:text-slate-200 focus:outline-hidden"
            >
              <option value="all">Tất cả các Ấp ({totalCount})</option>
              {hamletList.map(h => {
                const count = allResidents.filter(r => r.hamlet === h).length;
                return (
                  <option key={h} value={h}>
                    {h} ({count})
                  </option>
                );
              })}
            </select>
          </div>

          {/* Neighborhood Group */}
          <div>
            <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Tổ Dân Phố</label>
            <select
              id="filter-resident-neighborhood"
              value={neighborhoodFilter}
              onChange={e => setNeighborhoodFilter(e.target.value)}
              className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs text-slate-800 dark:text-slate-200 focus:outline-hidden"
            >
              <option value="all">Tất cả Tổ</option>
              {neighborhoodGroups.map(group => (
                <option key={group} value={group}>
                  {group}
                </option>
              ))}
            </select>
          </div>

          {/* Age Group */}
          <div>
            <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Độ Tuổi</label>
            <select
              id="filter-resident-age"
              value={ageGroupFilter}
              onChange={e => setAgeGroupFilter(e.target.value as any)}
              className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs text-slate-800 dark:text-slate-200 focus:outline-hidden"
            >
              <option value="all">Tất cả lứa tuổi</option>
              <option value="under18">Dưới 18 tuổi ({under18Count})</option>
              <option value="labor">Lao động 18-60 ({laborCount})</option>
              <option value="elderly">Người cao tuổi &gt;60 ({elderlyCount})</option>
            </select>
          </div>
        </div>
      </div>

      {/* Main Content: Table or Grid View */}
      {filteredResidents.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-12 text-center shadow-xs">
          <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-400 flex items-center justify-center mx-auto mb-3">
            <Users className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-slate-800 dark:text-white">Không tìm thấy nhân khẩu phù hợp</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
            Không có hồ sơ nhân khẩu nào thỏa mãn điều kiện tìm kiếm hoặc bộ lọc hiện tại.
          </p>
          <button
            type="button"
            onClick={handleResetFilters}
            className="mt-4 px-3.5 py-1.5 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-xl text-xs font-semibold transition"
          >
            Xóa toàn bộ bộ lọc
          </button>
        </div>
      ) : viewMode === 'table' ? (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-750 text-slate-600 dark:text-slate-300 uppercase tracking-wider text-[10px] font-bold">
                  <th className="py-3 px-3.5 w-10 text-center">STT</th>
                  <th className="py-3 px-3.5 min-w-[170px]">Họ Và Tên</th>
                  <th className="py-3 px-3.5 min-w-[140px]">Số CCCD / VNeID</th>
                  <th className="py-3 px-3.5 min-w-[110px]">Quan Hệ</th>
                  <th className="py-3 px-3.5 min-w-[180px]">Nơi Cư Trú (Số Nhà, Đường)</th>
                  <th className="py-3 px-3.5 min-w-[100px]">Loại Cư Trú</th>
                  <th className="py-3 px-3.5 min-w-[110px]">Diện ANTT</th>
                  <th className="py-3 px-3.5 min-w-[120px]">Liên Hệ / Nghề</th>
                  <th className="py-3 px-3.5 text-right w-24">Thao Tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredResidents.map((r, index) => {
                  const badge = getResidenceBadge(r.residenceType);
                  const age = currentYear - r.birthYear;
                  const parentHousehold = effectiveHouseholds.find(h => h.id === r.householdId);

                  return (
                    <tr key={r.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors">
                      <td className="py-3 px-3.5 text-center font-mono text-slate-400 text-[11px]">{index + 1}</td>

                      <td className="py-3 px-3.5">
                        <div className="flex items-center gap-2.5">
                          <div
                            className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${
                              r.gender === 'Nam'
                                ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/60 dark:text-blue-300'
                                : 'bg-rose-100 text-rose-700 dark:bg-rose-900/60 dark:text-rose-300'
                            }`}
                          >
                            {r.fullName.charAt(0)}
                          </div>
                          <div>
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedResident(r);
                                setIsDetailModalOpen(true);
                              }}
                              className="font-semibold text-slate-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400 text-left transition"
                            >
                              {r.fullName}
                            </button>
                            <div className="text-[10px] text-slate-500 dark:text-slate-400 flex items-center gap-1 mt-0.5">
                              <span>
                                Sinh: {r.birthYear} ({age} tuổi)
                              </span>
                              <span>•</span>
                              <span className={r.gender === 'Nam' ? 'text-blue-600' : 'text-rose-600'}>{r.gender}</span>
                            </div>
                          </div>
                        </div>
                      </td>

                      <td className="py-3 px-3.5">
                        {r.idCardNumber ? (
                          <div className="font-mono text-slate-800 dark:text-slate-200 text-xs font-semibold flex items-center gap-1.5">
                            <CreditCard className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            <span>{r.idCardNumber}</span>
                          </div>
                        ) : (
                          <span className="text-[11px] text-amber-600 dark:text-amber-400 font-medium italic">Chưa có CCCD</span>
                        )}
                      </td>

                      <td className="py-3 px-3.5">
                        <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-medium text-[11px]">
                          {r.relationship}
                        </span>
                      </td>

                      <td className="py-3 px-3.5">
                        <button
                          type="button"
                          onClick={() => {
                            if (parentHousehold) onSelectHousehold(parentHousehold);
                          }}
                          className="text-left group"
                          title="Xem chi tiết hộ gia đình"
                        >
                          <div className="font-semibold text-slate-800 dark:text-slate-200 group-hover:text-blue-600 flex items-center gap-1">
                            <span>
                              {r.houseNumber} {r.street}
                            </span>
                            <ChevronRight className="w-3 h-3 text-slate-400 group-hover:translate-x-0.5 transition" />
                          </div>
                          <div className="text-[10px] text-slate-500 mt-0.5">
                            {r.neighborhoodGroup || 'Tổ dân phố'} • {r.hamlet}
                          </div>
                        </button>
                      </td>

                      <td className="py-3 px-3.5">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${badge.bg}`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${badge.dot}`} />
                          {r.residenceType}
                        </span>
                      </td>

                      <td className="py-3 px-3.5">
                        {r.isMonitored ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-rose-100 dark:bg-rose-950/80 text-rose-700 dark:text-rose-300 border border-rose-300 dark:border-rose-800 text-[10px] font-bold">
                            <ShieldAlert className="w-3 h-3 text-rose-600" />
                            Chú ý ANTT
                          </span>
                        ) : (
                          <span className="text-slate-400 text-[11px]">Bình thường</span>
                        )}
                      </td>

                      <td className="py-3 px-3.5 text-[11px] text-slate-600 dark:text-slate-400">
                        {r.phone ? (
                          <a href={`tel:${r.phone}`} className="text-blue-600 hover:underline flex items-center gap-1 font-mono">
                            <Phone className="w-3 h-3" />
                            {r.phone}
                          </a>
                        ) : (
                          <div className="text-slate-400">Chưa có SĐT</div>
                        )}
                        <div className="text-[10px] text-slate-500 truncate max-w-[120px]">{r.occupation || 'Lao động tự do'}</div>
                      </td>

                      <td className="py-3 px-3.5 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedResident(r);
                              setIsDetailModalOpen(true);
                            }}
                            className="p-1 text-slate-400 hover:text-blue-600 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                            title="Xem chi tiết"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleOpenEditModal(r)}
                            className="p-1 text-slate-400 hover:text-amber-600 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                            title="Chỉnh sửa thông tin"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setResidentToDelete(r)}
                            className="p-1 text-slate-400 hover:text-rose-600 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                            title="Xóa nhân khẩu"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* Grid / Card View */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredResidents.map(r => {
            const badge = getResidenceBadge(r.residenceType);
            const age = currentYear - r.birthYear;
            const parentHousehold = effectiveHouseholds.find(h => h.id === r.householdId);

            return (
              <div
                key={r.id}
                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-xs hover:shadow-md transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div
                        className={`w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold shrink-0 ${
                          r.gender === 'Nam'
                            ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/60 dark:text-blue-300'
                            : 'bg-rose-100 text-rose-700 dark:bg-rose-900/60 dark:text-rose-300'
                        }`}
                      >
                        {r.fullName.charAt(0)}
                      </div>
                      <div className="min-w-0">
                        <h4
                          onClick={() => {
                            setSelectedResident(r);
                            setIsDetailModalOpen(true);
                          }}
                          className="font-bold text-slate-900 dark:text-white text-sm truncate hover:text-blue-600 cursor-pointer"
                        >
                          {r.fullName}
                        </h4>
                        <div className="text-[11px] text-slate-500 flex items-center gap-1.5">
                          <span>
                            {r.birthYear} ({age} tuổi)
                          </span>
                          <span>•</span>
                          <span className={r.gender === 'Nam' ? 'text-blue-600' : 'text-rose-600'}>{r.gender}</span>
                        </div>
                      </div>
                    </div>

                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border shrink-0 ${badge.bg}`}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full ${badge.dot}`} />
                      {r.residenceType}
                    </span>
                  </div>

                  {r.isMonitored && (
                    <div className="mt-2.5 p-2 bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900 rounded-lg flex items-center gap-2 text-[11px] text-rose-700 dark:text-rose-300 font-semibold">
                      <ShieldAlert className="w-3.5 h-3.5 shrink-0 text-rose-600" />
                      <span>Đối tượng cần chú ý nghiệp vụ ANTT</span>
                    </div>
                  )}

                  <div className="mt-3 space-y-1.5 text-xs text-slate-600 dark:text-slate-400">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">Số CCCD:</span>
                      <span className="font-mono font-semibold text-slate-800 dark:text-slate-200">{r.idCardNumber || 'Chưa cấp'}</span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">Quan hệ chủ hộ:</span>
                      <span className="font-medium text-slate-700 dark:text-slate-300">{r.relationship}</span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">Nghề nghiệp:</span>
                      <span className="truncate max-w-[150px]">{r.occupation || 'Tự do'}</span>
                    </div>

                    <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
                      <div className="text-[11px] font-medium text-slate-700 dark:text-slate-300 flex items-center gap-1">
                        <MapPin className="w-3 h-3 text-slate-400" />
                        <span className="truncate">
                          {r.houseNumber} {r.street}
                        </span>
                      </div>
                      <div className="text-[10px] text-slate-400 mt-0.5 ml-4">
                        Chủ hộ: {r.ownerName} ({r.hamlet})
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
                  {parentHousehold && (
                    <button
                      type="button"
                      onClick={() => onSelectHousehold(parentHousehold)}
                      className="text-[11px] text-blue-600 font-semibold hover:underline flex items-center gap-1"
                    >
                      <Home className="w-3 h-3" />
                      <span>Xem hộ</span>
                    </button>
                  )}

                  <div className="flex items-center gap-1 ml-auto">
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedResident(r);
                        setIsDetailModalOpen(true);
                      }}
                      className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition"
                      title="Xem chi tiết"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleOpenEditModal(r)}
                      className="p-1.5 text-slate-500 hover:text-amber-600 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition"
                      title="Chỉnh sửa"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setResidentToDelete(r)}
                      className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition"
                      title="Xóa"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ================= MODAL: CHI TIẾT NHÂN KHẨU ================= */}
      {isDetailModalOpen && selectedResident && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl">
            {/* Header */}
            <div className="bg-slate-900 text-white p-5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center text-white">
                  <UserCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold">Hồ Sơ Nhân Khẩu & Cư Trú</h3>
                  <div className="text-xs text-slate-400">
                    Mã nhân khẩu: {selectedResident.id}
                    {selectedResident.residentType ? ` • ${selectedResident.residentType}` : ''}
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsDetailModalOpen(false)}
                className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Body */}
            <div className="p-6 space-y-5 max-h-[80vh] overflow-y-auto">
              {/* Identity Banner */}
              <div className="p-4 bg-slate-50 dark:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3.5">
                  <div
                    className={`w-14 h-14 rounded-2xl flex items-center justify-center text-xl font-bold text-white shadow-sm ${
                      selectedResident.gender === 'Nam' ? 'bg-blue-600' : 'bg-rose-600'
                    }`}
                  >
                    {selectedResident.fullName.charAt(0)}
                  </div>
                  <div>
                    <div className="text-lg font-bold text-slate-900 dark:text-white">{selectedResident.fullName}</div>
                    <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      Năm sinh: {selectedResident.birthYear} ({currentYear - selectedResident.birthYear} tuổi) • {selectedResident.gender}
                    </div>
                  </div>
                </div>

                <div className="flex sm:flex-col items-end gap-1.5">
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-bold border ${getResidenceBadge(selectedResident.residenceType).bg}`}
                  >
                    {selectedResident.residenceType}
                  </span>
                  {selectedResident.isMonitored && (
                    <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-600 text-white shadow-xs">
                      Đối tượng chú ý ANTT
                    </span>
                  )}
                </div>
              </div>

              {/* Data Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-2">
                  <div className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5 border-b border-slate-100 dark:border-slate-800 pb-2">
                    <CreditCard className="w-4 h-4 text-blue-600" />
                    Thông Tin Định Danh
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Số CCCD / VNeID:</span>
                    <span className="font-mono font-bold text-slate-800 dark:text-white">
                      {selectedResident.idCardNumber || 'Chưa cập nhật'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Quan hệ với chủ hộ:</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200">{selectedResident.relationship}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Dân tộc:</span>
                    <span className="text-slate-700 dark:text-slate-300">{selectedResident.ethnicity || 'Kinh'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Nghề nghiệp:</span>
                    <span className="text-slate-700 dark:text-slate-300">{selectedResident.occupation || 'Tự do / Chưa khai'}</span>
                  </div>
                </div>

                <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-2">
                  <div className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5 border-b border-slate-100 dark:border-slate-800 pb-2">
                    <MapPin className="w-4 h-4 text-emerald-600" />
                    Địa Chỉ Nơi Cư Trú
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Hộ gia đình:</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200">{selectedResident.householdCode}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Chủ hộ:</span>
                    <span className="text-slate-700 dark:text-slate-300">{selectedResident.ownerName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Số nhà, đường:</span>
                    <span className="font-medium text-slate-800 dark:text-white text-right">
                      {selectedResident.houseNumber} {selectedResident.street}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Khu vực:</span>
                    <span className="text-slate-700 dark:text-slate-300">
                      {selectedResident.neighborhoodGroup || 'Tổ dân phố'} • {selectedResident.hamlet}
                    </span>
                  </div>
                </div>
              </div>

              {/* Notes & Security Details */}
              {selectedResident.notes && (
                <div className="p-3.5 bg-amber-50/70 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-xl text-xs">
                  <div className="font-bold text-amber-900 dark:text-amber-200 mb-1 flex items-center gap-1.5">
                    <Info className="w-4 h-4 text-amber-600" />
                    Ghi Chú Nghiệp Vụ CSKV
                  </div>
                  <p className="text-amber-800 dark:text-amber-300 leading-relaxed">{selectedResident.notes}</p>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-4 bg-slate-50 dark:bg-slate-800/60 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between">
              {selectedResident.phone ? (
                <a
                  href={`tel:${selectedResident.phone}`}
                  className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition"
                >
                  <Phone className="w-4 h-4" />
                  <span>Gọi {selectedResident.phone}</span>
                </a>
              ) : (
                <div className="text-xs text-slate-400">Chưa có số ĐT riêng</div>
              )}

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsDetailModalOpen(false);
                    handleOpenEditModal(selectedResident);
                  }}
                  className="px-3 py-2 bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200 hover:bg-slate-300 rounded-xl text-xs font-semibold transition flex items-center gap-1"
                >
                  <Edit className="w-3.5 h-3.5" />
                  <span>Sửa thông tin</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsDetailModalOpen(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-semibold transition"
                >
                  Đóng
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ================= MODAL: ĐĂNG KÝ THÊM NHÂN KHẨU MỚI ================= */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-xl overflow-hidden shadow-2xl">
            <div className="bg-blue-600 text-white p-5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-700 flex items-center justify-center text-white">
                  <UserPlus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold">Đăng Ký Nhân Khẩu Mới</h3>
                  <p className="text-xs text-blue-100">Bổ sung nhân khẩu vào hộ dân trên địa bàn</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="p-1.5 text-blue-200 hover:text-white rounded-lg hover:bg-blue-700 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveAddResident} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
              {/* Chọn Hộ Dân */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Chọn Hộ Dân Tiếp Nhận <span className="text-rose-500">*</span>
                </label>
                <select
                  value={formHouseholdId}
                  onChange={e => setFormHouseholdId(e.target.value)}
                  required
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs sm:text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                >
                  {effectiveHouseholds.map(h => (
                    <option key={h.id} value={h.id}>
                      [{h.code}] {h.houseNumber} {h.street} — Chủ hộ: {h.ownerName} ({h.hamlet})
                    </option>
                  ))}
                </select>
              </div>

              {/* Họ tên & Giới tính */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Họ và Tên <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formFullName}
                    onChange={e => setFormFullName(e.target.value)}
                    placeholder="Ví dụ: Nguyễn Văn An"
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs sm:text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Giới Tính</label>
                  <select
                    value={formGender}
                    onChange={e => setFormGender(e.target.value as any)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs sm:text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="Nam">Nam</option>
                    <option value="Nữ">Nữ</option>
                  </select>
                </div>
              </div>

              {/* Năm sinh & Số CCCD */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Năm Sinh <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="number"
                    min={1920}
                    max={currentYear}
                    required
                    value={formBirthYear}
                    onChange={e => setFormBirthYear(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs sm:text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                  />
                  <div className="text-[10px] text-slate-400 mt-0.5">Tuổi hiện tại: {currentYear - formBirthYear} tuổi</div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Số CCCD / Mã Định Danh</label>
                  <input
                    type="text"
                    maxLength={12}
                    value={formIdCardNumber}
                    onChange={e => setFormIdCardNumber(e.target.value)}
                    placeholder="12 chữ số CCCD"
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs sm:text-sm font-mono text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* Quan hệ chủ hộ & Loại cư trú */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Quan Hệ Với Chủ Hộ</label>
                  <input
                    type="text"
                    value={formRelationship}
                    onChange={e => setFormRelationship(e.target.value)}
                    placeholder="Chủ hộ, Vợ, Con, Bố, Mẹ, Khách trọ..."
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs sm:text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Loại Hình Cư Trú</label>
                  <select
                    value={formResidenceType}
                    onChange={e => setFormResidenceType(e.target.value as any)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs sm:text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="Thường trú">Thường trú (Có hộ khẩu)</option>
                    <option value="Tạm trú">Tạm trú (KT3, thuê trọ)</option>
                    <option value="Lưu trú">Lưu trú (Khách sạn, ngắn hạn)</option>
                  </select>
                </div>
              </div>

              {/* SĐT & Nghề nghiệp */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Số Điện Thoại Liên Hệ</label>
                  <input
                    type="text"
                    value={formPhone}
                    onChange={e => setFormPhone(e.target.value)}
                    placeholder="09xx.xxx.xxx"
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs sm:text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Nghề Nghiệp / Nơi Làm Việc</label>
                  <input
                    type="text"
                    value={formOccupation}
                    onChange={e => setFormOccupation(e.target.value)}
                    placeholder="Công nhân, Buôn bán, Học sinh..."
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs sm:text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* An ninh trật tự flag */}
              <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 rounded-xl flex items-center justify-between">
                <div>
                  <div className="text-xs font-bold text-rose-900 dark:text-rose-200 flex items-center gap-1.5">
                    <ShieldAlert className="w-4 h-4 text-rose-600" />
                    Diện Cần Chú Ý An Ninh Trật Tự
                  </div>
                  <div className="text-[11px] text-rose-700 dark:text-rose-300 mt-0.5">
                    Đánh dấu đối tượng có tiền án/tiền sự hoặc cần theo dõi nghiệp vụ
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={formIsMonitored}
                  onChange={e => setFormIsMonitored(e.target.checked)}
                  className="w-4 h-4 rounded text-rose-600 focus:ring-rose-500 cursor-pointer"
                />
              </div>

              {/* Ghi chú */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Ghi Chú Nhân Thân</label>
                <textarea
                  rows={2}
                  value={formNotes}
                  onChange={e => setFormNotes(e.target.value)}
                  placeholder="Ghi chú thêm về hoàn cảnh, thời gian chuyển đến..."
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs sm:text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Action Buttons */}
              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-semibold transition"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold shadow-md transition"
                >
                  Xác Nhận Đăng Ký
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= MODAL: CHỈNH SỬA NHÂN KHẨU ================= */}
      {isEditModalOpen && residentToEdit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-xl overflow-hidden shadow-2xl">
            <div className="bg-amber-600 text-white p-5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-700 flex items-center justify-center text-white">
                  <Edit className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold">Chỉnh Sửa Hồ Sơ Nhân Khẩu</h3>
                  <p className="text-xs text-amber-100">
                    Mã: {residentToEdit.id} • {residentToEdit.fullName}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsEditModalOpen(false)}
                className="p-1.5 text-amber-200 hover:text-white rounded-lg hover:bg-amber-700 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEditResident} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
              {/* Chọn Hộ Dân */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Hộ Dân Cư Trú (Có thể chuyển sang hộ khác)
                </label>
                <select
                  value={formHouseholdId}
                  onChange={e => setFormHouseholdId(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs sm:text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-amber-500"
                >
                  {effectiveHouseholds.map(h => (
                    <option key={h.id} value={h.id}>
                      [{h.code}] {h.houseNumber} {h.street} — Chủ hộ: {h.ownerName} ({h.hamlet})
                    </option>
                  ))}
                </select>
              </div>

              {/* Họ tên & Giới tính */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Họ và Tên <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formFullName}
                    onChange={e => setFormFullName(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs sm:text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Giới Tính</label>
                  <select
                    value={formGender}
                    onChange={e => setFormGender(e.target.value as any)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs sm:text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-amber-500"
                  >
                    <option value="Nam">Nam</option>
                    <option value="Nữ">Nữ</option>
                  </select>
                </div>
              </div>

              {/* Năm sinh & CCCD */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Năm Sinh</label>
                  <input
                    type="number"
                    min={1920}
                    max={currentYear}
                    value={formBirthYear}
                    onChange={e => setFormBirthYear(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs sm:text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Số CCCD / Mã Định Danh</label>
                  <input
                    type="text"
                    value={formIdCardNumber}
                    onChange={e => setFormIdCardNumber(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs sm:text-sm font-mono text-slate-900 dark:text-white focus:ring-2 focus:ring-amber-500"
                  />
                </div>
              </div>

              {/* Quan hệ & Loại cư trú */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Quan Hệ Chủ Hộ</label>
                  <input
                    type="text"
                    value={formRelationship}
                    onChange={e => setFormRelationship(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs sm:text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Loại Hình Cư Trú</label>
                  <select
                    value={formResidenceType}
                    onChange={e => setFormResidenceType(e.target.value as any)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs sm:text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-amber-500"
                  >
                    <option value="Thường trú">Thường trú</option>
                    <option value="Tạm trú">Tạm trú</option>
                    <option value="Lưu trú">Lưu trú</option>
                  </select>
                </div>
              </div>

              {/* SĐT & Nghề */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Số Điện Thoại</label>
                  <input
                    type="text"
                    value={formPhone}
                    onChange={e => setFormPhone(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs sm:text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Nghề Nghiệp</label>
                  <input
                    type="text"
                    value={formOccupation}
                    onChange={e => setFormOccupation(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs sm:text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-amber-500"
                  />
                </div>
              </div>

              {/* Monitored Checkbox */}
              <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 rounded-xl flex items-center justify-between">
                <div>
                  <div className="text-xs font-bold text-rose-900 dark:text-rose-200 flex items-center gap-1.5">
                    <ShieldAlert className="w-4 h-4 text-rose-600" />
                    Diện Cần Chú Ý An Ninh Trật Tự
                  </div>
                  <div className="text-[11px] text-rose-700 dark:text-rose-300 mt-0.5">Theo dõi đối tượng nghiệp vụ CSKV</div>
                </div>
                <input
                  type="checkbox"
                  checked={formIsMonitored}
                  onChange={e => setFormIsMonitored(e.target.checked)}
                  className="w-4 h-4 rounded text-rose-600 focus:ring-rose-500 cursor-pointer"
                />
              </div>

              {/* Ghi chú */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Ghi Chú</label>
                <textarea
                  rows={2}
                  value={formNotes}
                  onChange={e => setFormNotes(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs sm:text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-semibold transition"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-semibold shadow-md transition"
                >
                  Lưu Thay Đổi
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= MODAL: XÁC NHẬN XÓA NHÂN KHẨU ================= */}
      {residentToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-rose-100 dark:bg-rose-950/60 text-rose-600 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div className="text-center">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">Xóa Nhân Khẩu Khỏi Hồ Sơ?</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Bạn có chắc chắn muốn xóa nhân khẩu{' '}
                <span className="font-bold text-slate-800 dark:text-slate-200">{residentToDelete.fullName}</span> khỏi hộ gia đình{' '}
                <span className="font-bold text-slate-800 dark:text-slate-200">
                  {residentToDelete.householdCode} ({residentToDelete.houseNumber} {residentToDelete.street})
                </span>
                ? Thao tác này sẽ tự động cập nhật lại sĩ số nhân khẩu của hộ.
              </p>
            </div>
            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setResidentToDelete(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-semibold transition"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-semibold transition shadow-md"
              >
                Xác Nhận Xóa
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= MODAL: PHÂN TÍCH CƠ CẤU DÂN SỐ ================= */}
      {isDemographicModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl">
            <div className="bg-slate-900 text-white p-5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center text-white">
                  <BarChart3 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold">Phân Tích Cơ Cấu Dân Cư Địa Bàn</h3>
                  <p className="text-xs text-slate-400">Tổng quan nhân khẩu học trên địa bàn quản lý</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsDemographicModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-5 max-h-[80vh] overflow-y-auto text-xs">
              {/* Ratio Bars */}
              <div className="space-y-4">
                {/* Gender Ratio */}
                <div className="p-4 bg-slate-50 dark:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-700">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-bold text-slate-800 dark:text-white">Tỷ Lệ Giới Tính</span>
                    <span className="text-slate-500 font-mono">
                      Nam: {maleCount} ({totalCount > 0 ? Math.round((maleCount / totalCount) * 100) : 0}%) • Nữ: {femaleCount} (
                      {totalCount > 0 ? Math.round((femaleCount / totalCount) * 100) : 0}%)
                    </span>
                  </div>
                  <div className="w-full h-3.5 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden flex">
                    <div
                      style={{ width: `${totalCount > 0 ? (maleCount / totalCount) * 100 : 50}%` }}
                      className="bg-blue-600 h-full"
                      title={`Nam: ${maleCount}`}
                    />
                    <div
                      style={{ width: `${totalCount > 0 ? (femaleCount / totalCount) * 100 : 50}%` }}
                      className="bg-rose-500 h-full"
                      title={`Nữ: ${femaleCount}`}
                    />
                  </div>
                </div>

                {/* Residence Breakdown */}
                <div className="p-4 bg-slate-50 dark:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-700">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-bold text-slate-800 dark:text-white">Phân Bổ Loại Hình Cư Trú</span>
                    <span className="text-slate-500 font-mono">Tổng số: {totalCount} người</span>
                  </div>
                  <div className="w-full h-3.5 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden flex">
                    <div
                      style={{ width: `${totalCount > 0 ? (thuongTruCount / totalCount) * 100 : 0}%` }}
                      className="bg-emerald-500 h-full"
                      title={`Thường trú: ${thuongTruCount}`}
                    />
                    <div
                      style={{ width: `${totalCount > 0 ? (tamTruCount / totalCount) * 100 : 0}%` }}
                      className="bg-blue-500 h-full"
                      title={`Tạm trú: ${tamTruCount}`}
                    />
                    <div
                      style={{ width: `${totalCount > 0 ? (luuTruCount / totalCount) * 100 : 0}%` }}
                      className="bg-amber-500 h-full"
                      title={`Lưu trú: ${luuTruCount}`}
                    />
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-slate-500 mt-2">
                    <span className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                      Thường trú: {thuongTruCount} ({totalCount > 0 ? Math.round((thuongTruCount / totalCount) * 100) : 0}%)
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-blue-500" />
                      Tạm trú: {tamTruCount} ({totalCount > 0 ? Math.round((tamTruCount / totalCount) * 100) : 0}%)
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                      Lưu trú: {luuTruCount} ({totalCount > 0 ? Math.round((luuTruCount / totalCount) * 100) : 0}%)
                    </span>
                  </div>
                </div>

                {/* Age Pyramid */}
                <div className="p-4 bg-slate-50 dark:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-700">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-bold text-slate-800 dark:text-white">Cơ Cấu Độ Tuổi</span>
                    <span className="text-slate-500 font-mono">Trẻ em / Lao động / Người cao tuổi</span>
                  </div>
                  <div className="grid grid-cols-3 gap-3 text-center mt-3">
                    <div className="p-3 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-750">
                      <div className="text-[11px] text-slate-500">Dưới 18 tuổi</div>
                      <div className="text-lg font-bold text-slate-800 dark:text-white mt-1">{under18Count}</div>
                      <div className="text-[10px] text-slate-400 mt-0.5">
                        {totalCount > 0 ? Math.round((under18Count / totalCount) * 100) : 0}%
                      </div>
                    </div>
                    <div className="p-3 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-750">
                      <div className="text-[11px] text-slate-500">Lao động (18-60)</div>
                      <div className="text-lg font-bold text-blue-600 dark:text-blue-400 mt-1">{laborCount}</div>
                      <div className="text-[10px] text-slate-400 mt-0.5">
                        {totalCount > 0 ? Math.round((laborCount / totalCount) * 100) : 0}%
                      </div>
                    </div>
                    <div className="p-3 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-750">
                      <div className="text-[11px] text-slate-500">Trên 60 tuổi</div>
                      <div className="text-lg font-bold text-amber-600 dark:text-amber-400 mt-1">{elderlyCount}</div>
                      <div className="text-[10px] text-slate-400 mt-0.5">
                        {totalCount > 0 ? Math.round((elderlyCount / totalCount) * 100) : 0}%
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="p-4 bg-slate-50 dark:bg-slate-800/60 border-t border-slate-200 dark:border-slate-800 flex justify-end">
              <button
                type="button"
                onClick={() => setIsDemographicModalOpen(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-semibold transition"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
