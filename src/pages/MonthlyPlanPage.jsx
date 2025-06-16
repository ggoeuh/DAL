import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
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
  
  // 현재 월 키
  const currentMonthKey = format(new Date(), 'yyyy-MM');
  
  // 안전한 배열 보장
  const safeTags = Array.isArray(tags) ? tags : [];
  const safeTagItems = Array.isArray(tagItems) ? tagItems : [];
  const safeMonthlyGoals = Array.isArray(monthlyGoals) ? monthlyGoals : [];

  // ✅ 현재 월의 목표 가져오기 - useMemo로 최적화
  const currentMonthGoals = useMemo(() => {
    const currentGoal = safeMonthlyGoals.find(goal => goal.month === currentMonthKey);
    console.log('🎯 현재 월 목표 조회:', {
      currentMonthKey,
      foundGoal: currentGoal,
      allGoals: safeMonthlyGoals
    });
    return currentGoal?.goals || [];
  }, [safeMonthlyGoals, currentMonthKey]);

  // ✅ 태그별 목표 시간을 쉽게 찾는 함수
  const getTargetHoursForTagType = useCallback((tagType) => {
    const goal = currentMonthGoals.find(g => g.tagType === tagType);
    if (goal && goal.targetHours) {
      const [hours] = goal.targetHours.split(':').map(Number);
      return hours;
    }
    return 0;
  }, [currentMonthGoals]);

  // ✨ 서버에서 전체 사용자 데이터 로드
  const loadUserDataFromServer = useCallback(async () => {
    if (!currentUser || !supabase) return;

    try {
      setLoading(true);
      console.log('🌐 서버에서 사용자 데이터 로드 시작:', currentUser);

      const result = await loadUserDataFromDAL(currentUser);
      
      if (result.success && result.data) {
        const serverData = result.data;
        
        console.log('✅ 서버 데이터 로드 성공:', {
          schedules: serverData.schedules?.length || 0,
          tags: serverData.tags?.length || 0,
          tagItems: serverData.tagItems?.length || 0,
          monthlyGoals: serverData.monthlyGoals?.length || 0,
          monthlyPlans: serverData.monthlyPlans?.length || 0
        });

        // ✅ 서버 데이터를 상태에 저장
        setSchedules(serverData.schedules || []);
        setTags(serverData.tags || []);
        setTagItems(serverData.tagItems || []);
        setMonthlyGoals(serverData.monthlyGoals || []);
        setMonthlyPlans(serverData.monthlyPlans || []);
        
        // monthlyPlans를 plans로 설정 (호환성)
        setPlans(serverData.monthlyPlans || []);
        setLastSyncTime(new Date());

      } else {
        console.warn('⚠️ 서버 데이터 없음 또는 로드 실패:', result.error);
        // 빈 데이터로 초기화
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
  }, [currentUser, currentMonthKey]);

  // ✨ 서버에 전체 사용자 데이터 저장
  const saveUserDataToServer = useCallback(async (updatedData) => {
    if (!currentUser || saving) return;

    try {
      setSaving(true);
      console.log('🌐 서버에 데이터 저장 시작:', currentUser);

      const dataToSave = {
        schedules: updatedData.schedules || schedules,
        tags: updatedData.tags || tags,
        tagItems: updatedData.tagItems || tagItems,
        monthlyGoals: updatedData.monthlyGoals || monthlyGoals,
        monthlyPlans: updatedData.monthlyPlans || monthlyPlans
      };

      const result = await saveUserDataToDAL(currentUser, dataToSave);
      
      if (result.success) {
        console.log('✅ 서버 데이터 저장 성공');
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

  // ✨ 월간 계획만 저장 (목표 자동 생성 제거)
  const saveMonthlyPlans = useCallback(async (updatedPlans) => {
    if (!currentUser) return;

    console.log('💾 월간 계획 저장 시작:', { updatedPlans, currentMonthKey });

    // 서버에 월간 계획만 저장
    await saveUserDataToServer({
      monthlyPlans: updatedPlans
    });

    console.log('✅ 월간 계획 저장 완료');
  }, [currentUser, currentMonthKey, saveUserDataToServer]);

  // ✨ 초기 데이터 로드
  useEffect(() => {
    if (!currentUser) return;

    console.log('=== MonthlyPlan 초기화 시작 (서버 기반) ===', currentUser);
    loadUserDataFromServer();
  }, [currentUser, loadUserDataFromServer]);

  // ✨ 서버 데이터 새로고침 함수
  const handleRefreshData = useCallback(async () => {
    console.log('🔄 서버 데이터 수동 새로고침');
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

    // 서버에 저장
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

    // 서버에 저장
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

  // ✅ 목표를 기반으로 한 그룹화 (plans 대신 currentMonthGoals 사용)
  const getGroupedGoals = useMemo(() => {
    const grouped = {};
    console.log('🎯 Goals for display:', currentMonthGoals);
    
    currentMonthGoals.forEach(goal => {
      if (!grouped[goal.tagType]) {
        grouped[goal.tagType] = [];
      }
      
      // 해당 태그타입의 실제 계획들 찾기
      const relatedPlans = plans.filter(plan => plan.tagType === goal.tagType);
      
      if (relatedPlans.length > 0) {
        // 실제 계획들이 있으면 각각 표시
        relatedPlans.forEach(plan => {
          grouped[goal.tagType].push(plan);
        });
      } else {
        // 계획이 없으면 목표만 표시 (내용 없음)
        grouped[goal.tagType].push({
          id: `goal-${goal.tagType}`,
          tagType: goal.tagType,
          tag: goal.tagType + ' 목표',
          description: '', // 내용 없음
          estimatedTime: parseInt(goal.targetHours.split(':')[0]) || 0,
          isGoal: true
        });
      }
    });
    
    console.log('🎯 Grouped goals:', grouped);
    return grouped;
  }, [currentMonthGoals, plans]);

  const handleAddPlan = useCallback(async () => {
    const firstDesc = form.descriptions[0]?.trim();

    if (!form.tag.trim() || !firstDesc) {
      alert('태그와 일정 이름을 입력해주세요.');
      return;
    }

    const newPlan = {
      id: Date.now(),
      tagType: form.tagType,
      tag: form.tag,
      name: form.name,
      description: Array.isArray(form.descriptions)
        ? form.descriptions.filter(Boolean).join(', ')
        : '',
      estimatedTime: parseInt(form.estimatedTime) || 0
    };
    
    console.log('🆕 새 계획 생성:', newPlan);
    console.log('📝 description 내용:', newPlan.description);
    
    const updatedPlans = [...plans, newPlan];
    setPlans(updatedPlans);
    setMonthlyPlans(updatedPlans);

    console.log('📊 업데이트된 plans:', updatedPlans);

    // 월간 계획만 저장
    await saveMonthlyPlans(updatedPlans);

    setForm({
      tagType: '',
      tag: '',
      name: '',
      descriptions: ['', '', ''],
      estimatedTime: ''
    });
    setSelectedTagType('');
  }, [form, plans, saveMonthlyPlans]);
  
  const handleDeletePlan = useCallback(async (id) => {
    const updatedPlans = plans.filter(plan => plan.id !== id);
    setPlans(updatedPlans);
    setMonthlyPlans(updatedPlans);

    // 월간 계획만 업데이트
    await saveMonthlyPlans(updatedPlans);
  }, [plans, saveMonthlyPlans]);

  const handleGoBack = useCallback(() => {
    console.log('뒤로가기 버튼 클릭됨');
    navigate('/calendar');
  }, [navigate]);

  // ✨ 서버 데이터 정리 함수
  const handleServerDataCleanup = useCallback(async () => {
    if (!currentUser || !window.confirm('⚠️ 서버에서 불일치 데이터를 정리하시겠습니까?\n이 작업은 되돌릴 수 없습니다.')) {
      return;
    }

    try {
      setSaving(true);
      console.log('🧹 서버 데이터 정리 시작');

      // 서버에서 최신 데이터 로드
      await loadUserDataFromServer();
      
      // 데이터 정리 로직
      const cleanedTags = tags.filter(tag => tag.tagType && tag.tagType.trim());
      const cleanedTagItems = tagItems.filter(item => item.tagType && item.tagName && item.tagType.trim() && item.tagName.trim());
      const cleanedPlans = plans.filter(plan => plan.tagType && plan.tag && plan.tagType.trim() && plan.tag.trim());

      // 정리된 데이터로 상태 업데이트
      setTags(cleanedTags);
      setTagItems(cleanedTagItems);
      setPlans(cleanedPlans);
      setMonthlyPlans(cleanedPlans);

      // 월간 계획만 재저장
      await saveMonthlyPlans(cleanedPlans);

      console.log('✅ 서버 데이터 정리 완료');
      alert('✅ 서버 데이터 정리가 완료되었습니다.');
      
    } catch (error) {
      console.error('❌ 서버 데이터 정리 실패:', error);
      alert('❌ 서버 데이터 정리 중 오류가 발생했습니다: ' + error.message);
    } finally {
      setSaving(false);
    }
  }, [currentUser, tags, tagItems, plans, loadUserDataFromServer, saveMonthlyPlans]);

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
        {/* 메인 컨텐츠 영역 - 블록 기반 레이아웃 */}
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
              
              <h1 className="text-3xl font-bold">월간 계획 ({format(new Date(), 'yyyy년 M월')})</h1>
              
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
                개별 계획을 삭제하면 월간 목표도 자동으로 업데이트됩니다.
              </p>
              {currentMonthGoals.length > 0 && (
                <div className="mt-2 text-green-700 text-sm">
                  <span className="font-medium">🎯 이번 달 목표:</span> 
                  {currentMonthGoals.map(goal => `${goal.tagType}(${goal.targetHours})`).join(', ')}
                </div>
              )}
            </div>

            {/* 태그별 그룹화된 목표들 - 블록 레이아웃 */}
            <div className="space-y-6">
              {Object.entries(getGroupedGoals).map(([tagType, goalItems]) => {
                const colors = getTagColor(tagType);
                
                // 실제 계획된 시간 합계 (목표가 아닌 실제 계획들만)
                const actualPlannedTime = goalItems
                  .filter(item => !item.isGoal)
                  .reduce((sum, item) => sum + item.estimatedTime, 0);
                
                const targetHours = getTargetHoursForTagType(tagType);
                const achievementRate = targetHours > 0 ? Math.round((actualPlannedTime / targetHours) * 100) : 0;

                return (
                  <div key={tagType} className="flex items-start space-x-4">
                    {/* 왼쪽 태그 타입 블록 */}
                    <div className="flex flex-col items-center min-w-[120px] flex-shrink-0">
                      <div className={`px-4 py-3 rounded-lg text-lg font-semibold text-left bg-white ${colors.text} w-full border-2 ${colors.border}`}>
                        <div className="font-bold">{tagType}</div>
                        <div className="text-sm mt-1 opacity-80">
                          목표: {targetHours}시간
                        </div>
                        <div className="text-xs mt-1">
                          <div className={`font-medium ${achievementRate >= 100 ? 'text-green-600' : achievementRate >= 80 ? 'text-blue-600' : 'text-orange-600'}`}>
                            달성률: {achievementRate}%
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* 오른쪽 개별 계획 블록들 (가로 스크롤) */}
                    <div className="flex-1 min-w-0">
                      <div className="overflow-x-auto">
                        <div className="flex space-x-4 pb-4" style={{ minWidth: 'max-content' }}>
                          {goalItems.map((item) => (
                            <div key={item.id} className="w-[250px] flex-shrink-0">
                              <div className={`${colors.bg} ${colors.border} border rounded-lg p-3 relative`}>
                                <div className="flex justify-between items-center mb-2">
                                  <span className={`font-medium ${colors.text}`}>{item.tag}</span>
                                  <div className="flex items-center gap-2">
                                    <span className={`text-sm ${colors.text}`}>{item.estimatedTime}시간</span>
                                    {!item.isGoal && (
                                      <button
                                        onClick={() => handleDeletePlan(item.id)}
                                        disabled={saving}
                                        className="text-red-400 hover:text-red-600 text-sm disabled:opacity-50"
                                        title="이 계획 삭제"
                                      >
                                        ×
                                      </button>
                                    )}
                                  </div>
                                </div>
                                {item.description && (
                                  <div className={`text-sm ${colors.text} opacity-75`}>
                                    {item.description.split(', ').filter(desc => desc.trim()).map((desc, idx) => (
                                      <div key={idx}>• {desc.trim()}</div>
                                    ))}
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
                  <h3 className="text-xl font-medium mb-2">서버에 등록된 월간 계획이 없습니다</h3>
                  <p className="text-sm mb-4">오른쪽 패널에서 새로운 계획을 추가해보세요!</p>
                  <p className="text-xs text-gray-400">모든 데이터는 Supabase 서버에 안전하게 저장됩니다.</p>
                  {currentMonthGoals.length > 0 && (
                    <div className="mt-4 p-3 bg-yellow-50 rounded-lg border border-yellow-200">
                      <p className="text-yellow-800 text-sm">
                        <span className="font-medium">🎯 설정된 목표:</span>
                      </p>
                      <div className="mt-2">
                        {currentMonthGoals.map((goal, idx) => (
                          <div key={idx} className="text-yellow-700 text-sm">
                            {goal.tagType}: {goal.targetHours}
                          </div>
                        ))}
                      </div>
                      <p className="text-yellow-600 text-xs mt-2">
                        계획을 추가하면 목표와 연결됩니다.
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 오른쪽: 계획 추가 폼 */}
        <div className="w-96 border-l border-gray-200 bg-white p-6 mt-12">
          <div className="h-full flex flex-col">
            <h2 className="text-2xl font-bold mb-6">계획 추가</h2>
            
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
                {/* ✅ 선택된 태그의 목표 시간 표시 */}
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
                    
                    // ✅ 해당 태그타입의 목표 시간 조회
                    const targetHours = getTargetHoursForTagType(item.tagType);

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
                          title={targetHours > 0 ? `목표: ${targetHours}시간` : '목표 미설정'}
                        >
                          <div>{item.tagName}</div>
                          {/* ✅ 목표 시간 표시 */}
                          {targetHours > 0 && (
                            <div className="text-[10px] opacity-70">
                              목표: {targetHours}h
                            </div>
                          )}
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

              {/* ✅ 목표 요약 정보 */}
              {currentMonthGoals.length > 0 && (
                <div className="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
                  <h4 className="text-sm font-medium text-blue-800 mb-2">🎯 이번 달 목표</h4>
                  <div className="space-y-1">
                    {currentMonthGoals.map((goal, idx) => {
                      const plannedHours = plans
                        .filter(plan => plan.tagType === goal.tagType)
                        .reduce((sum, plan) => sum + plan.estimatedTime, 0);
                      const targetHours = parseInt(goal.targetHours.split(':')[0]);
                      const achievementRate = targetHours > 0 ? Math.round((plannedHours / targetHours) * 100) : 0;
                      
                      return (
                        <div key={idx} className="flex justify-between items-center text-xs">
                          <span className="text-blue-700">{goal.tagType}</span>
                          <div className="flex items-center gap-2">
                            <span className="text-blue-600">
                              {plannedHours}/{targetHours}시간
                            </span>
                            <span className={`font-medium ${
                              achievementRate >= 100 ? 'text-green-600' : 
                              achievementRate >= 80 ? 'text-blue-600' : 'text-orange-600'
                            }`}>
                              {achievementRate}%
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MonthlyPlan;
