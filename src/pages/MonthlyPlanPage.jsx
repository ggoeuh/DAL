import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { format, addMonths, subMonths } from 'date-fns';
import { saveUserDataToDAL, loadUserDataFromDAL, supabase } from './utils/supabaseStorage.js';

const MonthlyPlan = ({ 
  currentUser,
  onLogout 
}) => {
  const navigate = useNavigate();
  
  // 서버 기반 상태 관리
  const [plans, setPlans] = useState([]);
  const [schedules, setSchedules] = useState([]);
  const [tags, setTags] = useState([]);
  const [tagItems, setTagItems] = useState([]);
  const [monthlyGoals, setMonthlyGoals] = useState([]);
  const [monthlyPlans, setMonthlyPlans] = useState([]);
  
  // 월 네비게이션 상태
  const [currentDate, setCurrentDate] = useState(new Date());
  const currentMonthKey = format(currentDate, 'yyyy-MM');
  
  // 수정 모달 상태
  const [editingPlan, setEditingPlan] = useState(null);
  const [editForm, setEditForm] = useState({
    tag: '',
    name: '',
    descriptions: ['', '', ''],
    estimatedTime: ''
  });
  
  const [form, setForm] = useState({
    tagType: '',
    tag: '',
    name: '',
    descriptions: ['', '', ''],
    estimatedTime: ''
  });

  const [newTagType, setNewTagType] = useState('');
  const [newTagName, setNewTagName] = useState('');
  const [selectedTagType, setSelectedTagType] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState(null);
  
  // 안전한 배열 보장
  const safeTags = Array.isArray(tags) ? tags : [];
  const safeTagItems = Array.isArray(tagItems) ? tagItems : [];
  const safeMonthlyGoals = Array.isArray(monthlyGoals) ? monthlyGoals : [];

  // ✅ 현재 선택된 월의 목표 가져오기
  const currentMonthGoals = useMemo(() => {
    const currentGoal = safeMonthlyGoals.find(goal => goal.month === currentMonthKey);
    return currentGoal?.goals || [];
  }, [safeMonthlyGoals, currentMonthKey]);

  // ✅ 현재 선택된 월의 계획 가져오기
  const currentMonthPlans = useMemo(() => {
    return plans.filter(plan => {
      // plan에 month 정보가 있으면 해당 월만, 없으면 현재 월로 간주
      const planMonth = plan.month || format(new Date(), 'yyyy-MM');
      return planMonth === currentMonthKey;
    });
  }, [plans, currentMonthKey]);

  // ✅ 태그별 목표 시간을 쉽게 찾는 함수
  const getTargetHoursForTagType = useCallback((tagType) => {
    const goal = currentMonthGoals.find(g => g.tagType === tagType);
    if (goal && goal.targetHours) {
      const [hours] = goal.targetHours.split(':').map(Number);
      return hours;
    }
    return 0;
  }, [currentMonthGoals]);

  // ✨ 월 네비게이션 함수들
  const handlePrevMonth = useCallback(() => {
    setCurrentDate(prev => subMonths(prev, 1));
  }, []);

  const handleNextMonth = useCallback(() => {
    setCurrentDate(prev => addMonths(prev, 1));
  }, []);

  const handleCurrentMonth = useCallback(() => {
    setCurrentDate(new Date());
  }, []);

  // ✨ 계획 수정 모달 열기
  const handleEditPlan = useCallback((plan, e) => {
    e.stopPropagation();
    setEditingPlan(plan);
    
    // description을 배열로 변환
    const descriptions = plan.description 
      ? plan.description.split(', ').filter(desc => desc.trim())
      : [''];
    
    // 최소 3개 입력창 보장
    while (descriptions.length < 3) {
      descriptions.push('');
    }
    
    setEditForm({
      tag: plan.tag,
      name: plan.name || '',
      descriptions: descriptions,
      estimatedTime: plan.estimatedTime.toString()
    });
  }, []);

  // ✨ 계획 수정 저장
  const handleSaveEdit = useCallback(async () => {
    if (!editingPlan) return;

    const combinedDescription = editForm.descriptions
      .filter(desc => desc && desc.trim())
      .map(desc => desc.trim())
      .join(', ');

    const updatedPlan = {
      ...editingPlan,
      tag: editForm.tag,
      name: editForm.name,
      description: combinedDescription,
      estimatedTime: parseInt(editForm.estimatedTime) || 0
    };

    const updatedPlans = plans.map(plan => 
      plan.id === editingPlan.id ? updatedPlan : plan
    );
    
    setPlans(updatedPlans);
    setMonthlyPlans(updatedPlans);

    // 월간 목표 업데이트 및 서버 저장
    await updateAndSaveMonthlyGoals(updatedPlans);
    
    setEditingPlan(null);
    setEditForm({
      tag: '',
      name: '',
      descriptions: ['', '', ''],
      estimatedTime: ''
    });
  }, [editingPlan, editForm, plans]);

  // ✨ 개별 계획 삭제
  const handleDeleteSinglePlan = useCallback(async (planId, e) => {
    e.stopPropagation();
    
    if (!window.confirm('이 계획을 삭제하시겠습니까?')) {
      return;
    }

    const updatedPlans = plans.filter(plan => plan.id !== planId);
    setPlans(updatedPlans);
    setMonthlyPlans(updatedPlans);

    // 월간 목표 업데이트 및 서버 저장
    await updateAndSaveMonthlyGoals(updatedPlans);
  }, [plans]);

  // ✨ 서버 데이터 검증 및 정리 함수
  const validateAndCleanServerData = useCallback((serverData) => {
    if (!serverData) return {};
    
    const cleanedPlans = (serverData.monthlyPlans || []).map(plan => {
      let cleanDescription = plan.description || '';
      
      if (cleanDescription.includes('목표 시간:') || 
          cleanDescription.match(/^\d{1,3}:\d{2}$/) ||
          cleanDescription.match(/^목표\s*시간/)) {
        cleanDescription = '';
      }
      
      return {
        ...plan,
        description: cleanDescription,
        name: plan.name || '',
        estimatedTime: typeof plan.estimatedTime === 'number' ? plan.estimatedTime : parseInt(plan.estimatedTime) || 0
      };
    });
    
    return {
      ...serverData,
      monthlyPlans: cleanedPlans
    };
  }, []);

  // ✨ 서버에서 전체 사용자 데이터 로드
  const loadUserDataFromServer = useCallback(async () => {
    if (!currentUser || !supabase) return;

    try {
      setLoading(true);

      const result = await loadUserDataFromDAL(currentUser);
      
      if (result.success && result.data) {
        const validatedData = validateAndCleanServerData(result.data);
        
        setSchedules(validatedData.schedules || []);
        setTags(validatedData.tags || []);
        setTagItems(validatedData.tagItems || []);
        setMonthlyGoals(validatedData.monthlyGoals || []);
        setMonthlyPlans(validatedData.monthlyPlans || []);
        setPlans(validatedData.monthlyPlans || []);
        setLastSyncTime(new Date());

      } else {
        setSchedules([]);
        setTags([]);
        setTagItems([]);
        setMonthlyGoals([]);
        setMonthlyPlans([]);
        setPlans([]);
      }
    } catch (error) {
      console.error('❌ 서버 데이터 로드 실패:', error);
      alert('서버에서 데이터를 불러오는 중 오류가 발생했습니다: ' + error.message);
    } finally {
      setLoading(false);
    }
  }, [currentUser, validateAndCleanServerData]);

  // ✨ 서버에 전체 사용자 데이터 저장
  const saveUserDataToServer = useCallback(async (updatedData) => {
    if (!currentUser || saving) return;

    try {
      setSaving(true);

      const dataToSave = {
        schedules: updatedData.schedules || schedules,
        tags: updatedData.tags || tags,
        tagItems: updatedData.tagItems || tagItems,
        monthlyGoals: updatedData.monthlyGoals || monthlyGoals,
        monthlyPlans: updatedData.monthlyPlans || monthlyPlans
      };

      const result = await saveUserDataToDAL(currentUser, dataToSave);
      
      if (result.success) {
        setLastSyncTime(new Date());
        return true;
      } else {
        throw new Error(result.error || '서버 저장 실패');
      }
    } catch (error) {
      console.error('❌ 서버 데이터 저장 실패:', error);
      alert('서버에 데이터를 저장하는 중 오류가 발생했습니다: ' + error.message);
      return false;
    } finally {
      setSaving(false);
    }
  }, [currentUser, saving, schedules, tags, tagItems, monthlyGoals, monthlyPlans]);

  // ✨ 월간 목표 업데이트 및 저장
  const updateAndSaveMonthlyGoals = useCallback(async (updatedPlans) => {
    if (!currentUser) return;

    // 현재 선택된 월의 계획만 필터링
    const currentMonthFilteredPlans = updatedPlans.filter(plan => {
      const planMonth = plan.month || format(new Date(), 'yyyy-MM');
      return planMonth === currentMonthKey;
    });

    // 계획에서 태그타입별 시간 집계
    const goalsByTagType = {};
    currentMonthFilteredPlans.forEach(plan => {
      if (!goalsByTagType[plan.tagType]) {
        goalsByTagType[plan.tagType] = 0;
      }
      goalsByTagType[plan.tagType] += plan.estimatedTime;
    });

    // 기존 월간 목표 가져오기
    let updatedGoals = [...safeMonthlyGoals];
    let currentMonthGoal = updatedGoals.find(goal => goal.month === currentMonthKey);
    
    if (!currentMonthGoal) {
      currentMonthGoal = { month: currentMonthKey, goals: [] };
      updatedGoals.push(currentMonthGoal);
    }

    // 계획이 있는 태그타입들의 목표만 업데이트
    const planTagTypes = Object.keys(goalsByTagType);
    const existingGoals = currentMonthGoal.goals.filter(goal => !planTagTypes.includes(goal.tagType));
    
    const newGoals = Object.entries(goalsByTagType).map(([tagType, totalHours]) => ({
      tagType,
      targetHours: `${totalHours.toString().padStart(2, '0')}:00`
    }));

    currentMonthGoal.goals = [...existingGoals, ...newGoals];
    setMonthlyGoals(updatedGoals);
    
    const saveResult = await saveUserDataToServer({
      monthlyGoals: updatedGoals,
      monthlyPlans: updatedPlans
    });

    return saveResult;
  }, [currentUser, currentMonthKey, safeMonthlyGoals, saveUserDataToServer]);

  // ✨ 초기 데이터 로드
  useEffect(() => {
    if (!currentUser) return;
    loadUserDataFromServer();
  }, [currentUser, loadUserDataFromServer]);

  // ✨ 서버 데이터 새로고침 함수
  const handleRefreshData = useCallback(async () => {
    await loadUserDataFromServer();
  }, [loadUserDataFromServer]);

  const handleSelectTag = useCallback((tagType, tagName) => {
    setSelectedTagType(tagType);
    setForm((prev) => ({
      ...prev,
      tagType,
      tag: tagName
    }));
  }, []);
  
  const handleAddTag = useCallback(async () => {
    if (!newTagType.trim() || !newTagName.trim()) return;

    const newItem = { tagType: newTagType, tagName: newTagName };
    const updatedTagItems = [...safeTagItems, newItem];
    setTagItems(updatedTagItems);

    const existingTag = safeTags.find(tag => tag.tagType === newTagType);
    let updatedTags = tags;
    
    if (!existingTag) {
      const newTag = {
        tagType: newTagType,
        color: getRandomTagColor()
      };
      updatedTags = [...safeTags, newTag];
      setTags(updatedTags);
    }

    await saveUserDataToServer({
      tags: updatedTags,
      tagItems: updatedTagItems
    });

    setNewTagType('');
    setNewTagName('');
  }, [newTagType, newTagName, safeTagItems, safeTags, tags, saveUserDataToServer]);
  
  const handleDeleteTagItem = useCallback(async (tagType, tagName) => {
    const updatedTagItems = safeTagItems.filter(item => !(item.tagType === tagType && item.tagName === tagName));
    setTagItems(updatedTagItems);

    await saveUserDataToServer({
      tagItems: updatedTagItems
    });
  }, [safeTagItems, saveUserDataToServer]);

  const getRandomTagColor = () => {
    const colorOptions = [
      { bg: 'bg-blue-100', text: 'text-blue-800', border: 'border-blue-200' },
      { bg: 'bg-orange-100', text: 'text-orange-800', border: 'border-orange-200' },
      { bg: 'bg-purple-100', text: 'text-purple-800', border: 'border-purple-200' },
      { bg: 'bg-green-100', text: 'text-green-800', border: 'border-green-200' },
      { bg: 'bg-pink-100', text: 'text-pink-800', border: 'border-pink-200' },
      { bg: 'bg-indigo-100', text: 'text-indigo-800', border: 'border-indigo-200' },
      { bg: 'bg-red-100', text: 'text-red-800', border: 'border-red-200' },
      { bg: 'bg-yellow-100', text: 'text-yellow-800', border: 'border-yellow-200' }
    ];
    return colorOptions[Math.floor(Math.random() * colorOptions.length)];
  };

  const getTagColor = useCallback((tagType) => {
    const tag = safeTags.find(t => t.tagType === tagType);
    return tag ? tag.color : { bg: 'bg-gray-100', text: 'text-gray-800', border: 'border-gray-200' };
  }, [safeTags]);

  // ✅ 목표를 기반으로 한 그룹화
  const getGroupedGoals = useMemo(() => {
    const grouped = {};
    
    currentMonthGoals.forEach(goal => {
      if (!grouped[goal.tagType]) {
        grouped[goal.tagType] = [];
      }
      
      // 해당 태그타입의 실제 계획들 찾기 (현재 월만)
      const relatedPlans = currentMonthPlans.filter(plan => plan.tagType === goal.tagType);
      
      if (relatedPlans.length > 0) {
        relatedPlans.forEach(plan => {
          grouped[goal.tagType].push(plan);
        });
      } else {
        grouped[goal.tagType].push({
          id: `goal-${goal.tagType}`,
          tagType: goal.tagType,
          tag: goal.tagType + ' 목표',
          description: '',
          estimatedTime: parseInt(goal.targetHours.split(':')[0]) || 0,
          isGoal: true
        });
      }
    });
    
    return grouped;
  }, [currentMonthGoals, currentMonthPlans]);

  // ✨ 계획 추가 함수
  const handleAddPlan = useCallback(async () => {
    const firstDesc = form.descriptions[0]?.trim();

    if (!form.tag.trim() || !firstDesc) {
      alert('태그와 일정 이름을 입력해주세요.');
      return;
    }

    const combinedDescription = form.descriptions
      .filter(desc => desc && desc.trim())
      .map(desc => desc.trim())
      .join(', ');

    const newPlan = {
      id: Date.now(),
      tagType: form.tagType,
      tag: form.tag,
      name: form.name || '',
      description: combinedDescription,
      estimatedTime: parseInt(form.estimatedTime) || 0,
      month: currentMonthKey // 현재 선택된 월 저장
    };
    
    const updatedPlans = [...plans, newPlan];
    setPlans(updatedPlans);
    setMonthlyPlans(updatedPlans);

    const saveResult = await updateAndSaveMonthlyGoals(updatedPlans);
    
    if (saveResult !== false) {
      setForm({
        tagType: '',
        tag: '',
        name: '',
        descriptions: ['', '', ''],
        estimatedTime: ''
      });
      setSelectedTagType('');
    }
  }, [form, plans, currentMonthKey, updateAndSaveMonthlyGoals]);
  
  const handleDeletePlan = useCallback(async (id) => {
    const updatedPlans = plans.filter(plan => plan.id !== id);
    setPlans(updatedPlans);
    setMonthlyPlans(updatedPlans);

    await updateAndSaveMonthlyGoals(updatedPlans);
  }, [plans, updateAndSaveMonthlyGoals]);

  const handleGoBack = useCallback(() => {
    navigate('/calendar');
  }, [navigate]);

  // ✨ 서버 데이터 정리 함수
  const handleServerDataCleanup = useCallback(async () => {
    if (!currentUser || !window.confirm('⚠️ 서버에서 잘못된 데이터를 정리하시겠습니까?')) {
      return;
    }

    try {
      setSaving(true);
      await loadUserDataFromServer();
      
      const cleanedTags = tags.filter(tag => tag.tagType && tag.tagType.trim());
      const cleanedTagItems = tagItems.filter(item => item.tagType && item.tagName && item.tagType.trim() && item.tagName.trim());
      
      const cleanedPlans = plans.map(plan => {
        let cleanDescription = plan.description || '';
        
        if (cleanDescription.includes('목표 시간:') || 
            cleanDescription.match(/^\d{1,3}:\d{2}$/) ||
            cleanDescription.match(/^목표\s*시간/)) {
          cleanDescription = '';
        }
        
        return {
          ...plan,
          description: cleanDescription,
          estimatedTime: typeof plan.estimatedTime === 'number' ? plan.estimatedTime : parseInt(plan.estimatedTime) || 0
        };
      }).filter(plan => plan.tagType && plan.tag && plan.tagType.trim() && plan.tag.trim());

      setTags(cleanedTags);
      setTagItems(cleanedTagItems);
      setPlans(cleanedPlans);
      setMonthlyPlans(cleanedPlans);

      await updateAndSaveMonthlyGoals(cleanedPlans);

      alert('✅ 서버 데이터 정리가 완료되었습니다.');
      
    } catch (error) {
      console.error('❌ 서버 데이터 정리 실패:', error);
      alert('❌ 서버 데이터 정리 중 오류가 발생했습니다: ' + error.message);
    } finally {
      setSaving(false);
    }
  }, [currentUser, tags, tagItems, plans, loadUserDataFromServer, updateAndSaveMonthlyGoals]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-600">서버에서 월간 계획 데이터를 불러오는 중...</p>
          <p className="text-sm text-gray-500 mt-2">Supabase 연결 중...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 서버 연동 상태 표시 배너 */}
      <div className="fixed top-0 left-0 right-0 bg-blue-50 border-b border-blue-200 p-2 z-50">
        <div className="max-w-7xl mx-auto flex justify-between items-center text-sm">
          <div className="flex items-center space-x-4">
            <span className="flex items-center text-blue-700">
              <span className="w-2 h-2 bg-green-500 rounded-full mr-2"></span>
              서버 기반 모드
            </span>
            <span className="text-blue-600">
              사용자: {currentUser}
            </span>
            <span className="text-purple-600">
              이번 달 목표: {currentMonthGoals.length}개
            </span>
            {lastSyncTime && (
              <span className="text-blue-500">
                마지막 동기화: {lastSyncTime.toLocaleTimeString('ko-KR')}
              </span>
            )}
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={handleRefreshData}
              disabled={loading || saving}
              className="bg-blue-100 hover:bg-blue-200 text-blue-700 px-3 py-1 rounded text-xs font-medium transition-colors disabled:opacity-50"
            >
              {loading ? '🔄 로딩...' : '🔄 새로고침'}
            </button>
            <span className="text-blue-500 text-xs">
              {saving ? '저장 중...' : 'Supabase 연결됨'}
            </span>
          </div>
        </div>
      </div>

      <div className="flex">
        {/* 메인 컨텐츠 영역 */}
        <div className="flex-1 p-6 mt-12">
          <div className="max-w-6xl mx-auto">
            {/* 헤더 */}
            <div className="flex items-center justify-between mb-8">
              <button
                onClick={handleGoBack}
                className="flex items-center text-gray-600 hover:text-gray-800 cursor-pointer z-10 bg-white px-3 py-2 rounded border hover:bg-gray-50 transition-colors shadow-sm"
              >
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                뒤로 가기
              </button>
              
              {/* 월 네비게이션 */}
              <div className="flex items-center gap-4">
                <button
                  onClick={handlePrevMonth}
                  className="p-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-full transition-colors"
                  title="이전 월"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                
                <h1 className="text-3xl font-bold">
                  월간 계획 ({format(currentDate, 'yyyy년 M월')})
                </h1>
                
                <button
                  onClick={handleNextMonth}
                  className="p-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-full transition-colors"
                  title="다음 월"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
                
                <button
                  onClick={handleCurrentMonth}
                  className="px-3 py-1 text-sm bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition-colors"
                  title="현재 월로 이동"
                >
                  이번달
                </button>
              </div>
              
              <div className="flex items-center gap-3">
                {currentUser && (
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <span>🧑‍💻 {currentUser}</span>
                    <span className="text-blue-600">서버 기반</span>
                    <button
                      onClick={onLogout}
                      className="text-red-500 hover:text-red-700 underline"
                    >
                      로그아웃
                    </button>
                  </div>
                )}
                <button
                  onClick={handleServerDataCleanup}
                  disabled={saving}
                  className="bg-yellow-100 hover:bg-yellow-200 text-yellow-700 px-3 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                  title="서버 데이터 정리"
                >
                  {saving ? '처리 중...' : '🧹 서버 정리'}
                </button>
              </div>
            </div>

            {/* 서버 기반 안내 메시지 */}
            <div className="mb-6 p-4 bg-green-50 rounded-lg border border-green-200">
              <p className="text-green-800 text-sm">
                <span className="font-medium">🌐 서버 기반:</span> 모든 변경사항이 Supabase 서버에 자동으로 저장됩니다. 
                블럭을 클릭하면 수정할 수 있습니다.
              </p>
              {currentMonthGoals.length > 0 && (
                <div className="mt-2 text-green-700 text-sm">
                  <span className="font-medium">🎯 {format(currentDate, 'M월')} 목표:</span> 
                  {currentMonthGoals.map(goal => `${goal.tagType}(${goal.targetHours})`).join(', ')}
                </div>
              )}
            </div>

            {/* 태그별 그룹화된 목표들 */}
            <div className="space-y-6">
              {Object.entries(getGroupedGoals).map(([tagType, goalItems]) => {
                const colors = getTagColor(tagType);
                const actualPlannedTime = currentMonthPlans
                  .filter(plan => plan.tagType === tagType)
                  .reduce((sum, plan) => sum + plan.estimatedTime, 0);
                const targetHours = getTargetHoursForTagType(tagType);

                return (
                  <div key={tagType} className="flex items-start space-x-4">
                    {/* 왼쪽 태그 타입 블록 */}
                    <div className="flex flex-col items-center min-w-[120px] flex-shrink-0">
                      <div className={`px-4 py-3 rounded-lg text-lg font-semibold text-left bg-white ${colors.text} w-full border-2 ${colors.border}`}>
                        <div className="font-bold">{tagType}</div>
                        <div className="text-sm mt-1 opacity-80">
                          목표: {targetHours}시간
                        </div>
                      </div>
                    </div>

                    {/* 오른쪽 개별 계획 블록들 */}
                    <div className="flex-1 min-w-0">
                      <div className="overflow-x-auto">
                        <div className="flex space-x-4 pb-4" style={{ minWidth: 'max-content' }}>
                          {goalItems.map((item) => (
                            <div key={item.id} className="w-[250px] flex-shrink-0">
                              <div 
                                className={`${colors.bg} ${colors.border} border rounded-lg p-3 relative cursor-pointer hover:shadow-md transition-shadow ${!item.isGoal ? 'hover:bg-opacity-80' : ''}`}
                                onClick={() => !item.isGoal && handleEditPlan(item)}
                              >
                                {/* 수정/삭제 버튼 (실제 계획만) */}
                                {!item.isGoal && (
                                  <div className="absolute top-2 right-2 flex gap-1">
                                    <button
                                      onClick={(e) => handleEditPlan(item, e)}
                                      disabled={saving}
                                      className="text-gray-400 hover:text-blue-600 text-xs bg-white rounded px-1 py-0.5 shadow-sm disabled:opacity-50"
                                      title="수정"
                                    >
                                      수정
                                    </button>
                                    <button
                                      onClick={(e) => handleDeleteSinglePlan(item.id, e)}
                                      disabled={saving}
                                      className="text-gray-400 hover:text-red-600 text-xs bg-white rounded px-1 py-0.5 shadow-sm disabled:opacity-50"
                                      title="삭제"
                                    >
                                      삭제
                                    </button>
                                  </div>
                                )}
                                
                                <div className="flex justify-between items-center mb-2 pr-16">
                                  <span className={`font-medium ${colors.text}`}>{item.tag}</span>
                                  <span className={`text-sm ${colors.text}`}>{item.estimatedTime}시간</span>
                                </div>
                                
                                {item.description && (
                                  <div className={`text-sm ${colors.text} opacity-75`}>
                                    {item.description.split(', ').filter(desc => desc.trim()).map((desc, idx) => (
                                      <div key={idx}>• {desc.trim()}</div>
                                    ))}
                                  </div>
                                )}
                                
                                {!item.description && !item.isGoal && (
                                  <div className={`text-sm ${colors.text} opacity-50 italic`}>
                                    클릭하여 내용을 추가하세요
                                  </div>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
              
              {Object.keys(getGroupedGoals).length === 0 && (
                <div className="text-center py-12 text-gray-500">
                  <h3 className="text-xl font-medium mb-2">
                    {format(currentDate, 'yyyy년 M월')}에 등록된 월간 계획이 없습니다
                  </h3>
                  <p className="text-sm mb-4">오른쪽 패널에서 새로운 계획을 추가해보세요!</p>
                  <p className="text-xs text-gray-400">모든 데이터는 Supabase 서버에 안전하게 저장됩니다.</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 오른쪽: 계획 추가 폼 */}
        <div className="w-96 border-l border-gray-200 bg-white p-6 mt-12">
          <div className="h-full flex flex-col">
            <h2 className="text-2xl font-bold mb-6">
              계획 추가 ({format(currentDate, 'M월')})
            </h2>
            
            <div className="flex-1 space-y-4">
              <div className="bg-gray-50 p-4 rounded-lg">
                <div className="flex items-center text-gray-600 mb-2">
                  <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <circle cx="12" cy="12" r="10"/>
                    <polyline points="12,6 12,12 16,14"/>
                  </svg>
                  예상 시간
                </div>
                <input
                  type="number"
                  placeholder="예상 시간을 입력하세요"
                  className="w-full bg-white border border-gray-200 rounded-md px-3 py-2 focus:outline-none focus:border-blue-400"
                  value={form.estimatedTime}
                  onChange={(e) => setForm({ ...form, estimatedTime: e.target.value })}
                  disabled={saving}
                />
                {form.tagType && (
                  <div className="mt-2 text-xs text-gray-600">
                    {(() => {
                      const targetHours = getTargetHoursForTagType(form.tagType);
                      if (targetHours > 0) {
                        return (
                          <span className="text-blue-600">
                            🎯 {form.tagType} 목표: {targetHours}시간
                          </span>
                        );
                      } else {
                        return (
                          <span className="text-gray-500">
                            목표 미설정 (계획 추가 시 자동 생성)
                          </span>
                        );
                      }
                    })()}
                  </div>
                )}
              </div>

              <div className="space-y-2">
                {form.descriptions.map((desc, idx) => (
                  <div className="relative" key={idx}>
                    <span className="absolute left-3 top-4 text-gray-400 text-sm">{idx + 1}.</span>
                    <input
                      type="text"
                      placeholder="일정 내용을 적어주세요"
                      className="w-full pl-8 pr-3 py-3 border border-gray-200 rounded-md focus:outline-none focus:border-blue-400"
                      value={desc}
                      disabled={saving}
                      onChange={(e) => {
                        const updated = [...form.descriptions];
                        updated[idx] = e.target.value;
                        setForm({ ...form, descriptions: updated });
                      }}
                    />
                  </div>
                ))}
                <button
                  type="button"
                  disabled={saving}
                  className="w-full py-2 text-sm bg-gray-100 rounded-md hover:bg-gray-200 text-gray-700 disabled:opacity-50"
                  onClick={() => setForm({ ...form, descriptions: [...form.descriptions, ''] })}
                >
                  + 내용 추가
                </button>
              </div>

              <div className="mb-3">
                <h3 className="font-medium mb-2">태그 선택</h3>
                <div className="h-48 overflow-y-auto pr-1 border rounded-md p-3 bg-white">
                  {safeTagItems.map((item, idx) => {
                    const tagGroup = safeTags.find(t => t.tagType === item.tagType);
                    const tagColor = tagGroup ? tagGroup.color : { bg: "bg-gray-100", text: "text-gray-800" };
                    const isSelected = selectedTagType === item.tagType && form.tag === item.tagName;

                    return (
                      <div key={idx} className="flex items-center mb-2 last:mb-0">
                        <div className={`w-16 ${tagColor.bg} ${tagColor.text} px-2 py-1 rounded-l-md text-xs font-medium truncate`}>
                          {item.tagType}
                        </div>
                        <div
                          className={`flex-1 ${tagColor.bg} ${tagColor.text} px-2 py-1 text-xs cursor-pointer hover:bg-opacity-80 transition-colors ${
                            isSelected ? 'ring-2 ring-blue-400 bg-opacity-90' : ''
                          } ${saving ? 'opacity-50 cursor-not-allowed' : ''}`}
                          onClick={() => !saving && handleSelectTag(item.tagType, item.tagName)}
                        >
                          <div>{item.tagName}</div>
                        </div>
                        <button
                          className="bg-red-100 text-red-500 rounded-r-md px-2 py-1 text-xs disabled:opacity-50"
                          disabled={saving}
                          onClick={() => handleDeleteTagItem(item.tagType, item.tagName)}
                        >
                          ×
                        </button>
                      </div>
                    );
                  })}
                  {safeTagItems.length === 0 && (
                    <div className="text-center text-gray-500 py-15 text-sm">
                      서버에서 태그를 불러오거나 새로 추가해주세요
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-1 mb-1">
                <input
                  type="text"
                  placeholder="태그"
                  className="w-16 text-xs bg-white border rounded-l-md px-2 py-1 focus:outline-none focus:border-gray-400"
                  value={newTagType}
                  disabled={saving}
                  onChange={(e) => setNewTagType(e.target.value)}
                />
                <input
                  type="text"
                  placeholder="항목 이름"
                  className="flex-1 text-xs bg-white border-y border-r-0 px-2 py-1 focus:outline-none focus:border-gray-400"
                  value={newTagName}
                  disabled={saving}
                  onChange={(e) => setNewTagName(e.target.value)}
                />
                <button
                  className="bg-gray-200 w-8 h-6 rounded-r-md flex items-center justify-center text-sm font-bold disabled:opacity-50"
                  disabled={saving}
                  onClick={handleAddTag}
                >
                  +
                </button>
              </div>

              <button
                className="w-full bg-green-100 text-center py-3 rounded-lg text-xl font-medium text-green-800 disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={saving}
                onClick={handleAddPlan}
              >
                {saving ? '서버에 저장 중...' : '일정 추가하기'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 수정 모달 */}
      {editingPlan && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-96 max-h-[80vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold">계획 수정</h3>
              <button
                onClick={() => setEditingPlan(null)}
                className="text-gray-500 hover:text-gray-700"
              >
                ×
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  태그명
                </label>
                <input
                  type="text"
                  className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:border-blue-400"
                  value={editForm.tag}
                  onChange={(e) => setEditForm({ ...editForm, tag: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  예상 시간
                </label>
                <input
                  type="number"
                  className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:border-blue-400"
                  value={editForm.estimatedTime}
                  onChange={(e) => setEditForm({ ...editForm, estimatedTime: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  일정 내용
                </label>
                <div className="space-y-2">
                  {editForm.descriptions.map((desc, idx) => (
                    <div className="relative" key={idx}>
                      <span className="absolute left-3 top-3 text-gray-400 text-sm">{idx + 1}.</span>
                      <input
                        type="text"
                        placeholder="일정 내용을 적어주세요"
                        className="w-full pl-8 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:border-blue-400"
                        value={desc}
                        onChange={(e) => {
                          const updated = [...editForm.descriptions];
                          updated[idx] = e.target.value;
                          setEditForm({ ...editForm, descriptions: updated });
                        }}
                      />
                    </div>
                  ))}
                  <button
                    type="button"
                    className="w-full py-2 text-sm bg-gray-100 rounded-md hover:bg-gray-200 text-gray-700"
                    onClick={() => setEditForm({ 
                      ...editForm, 
                      descriptions: [...editForm.descriptions, ''] 
                    })}
                  >
                    + 내용 추가
                  </button>
                </div>
              </div>

              <div className="flex gap-2 pt-4">
                <button
                  onClick={handleSaveEdit}
                  disabled={saving}
                  className="flex-1 bg-blue-500 text-white py-2 rounded-md hover:bg-blue-600 disabled:opacity-50"
                >
                  {saving ? '저장 중...' : '저장'}
                </button>
                <button
                  onClick={() => setEditingPlan(null)}
                  className="flex-1 bg-gray-300 text-gray-700 py-2 rounded-md hover:bg-gray-400"
                >
                  취소
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MonthlyPlan;
