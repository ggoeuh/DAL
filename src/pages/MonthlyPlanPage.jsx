import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';

const MonthlyPlan = ({ 
  schedules = [], 
  setSchedules, 
  tags = [], 
  setTags, 
  tagItems = [], 
  setTagItems, 
  currentUser,
  onLogout 
}) => {
  const navigate = useNavigate();
  const [plans, setPlans] = useState([]);
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
  
  // 현재 월 키
  const currentMonthKey = format(new Date(), 'yyyy-MM');
  
  // 안전한 배열 보장
  const safeTags = Array.isArray(tags) ? tags : [];
  const safeTagItems = Array.isArray(tagItems) ? tagItems : [];
  
  // 로컬스토리지 함수들
  const saveToLocalStorage = (key, data) => {
    try {
      localStorage.setItem(key, JSON.stringify(data));
      console.log(`💾 저장 완료: ${key}`, data);
    } catch (error) {
      console.error('저장 실패:', error);
    }
  };

  const loadFromLocalStorage = (key, defaultValue = []) => {
    try {
      const data = localStorage.getItem(key);
      return data ? JSON.parse(data) : defaultValue;
    } catch (error) {
      console.error('불러오기 실패:', error);
      return defaultValue;
    }
  };

  

  // 완전 삭제 함수
  const resetUserDataComplete = (nickname) => {
    if (!nickname) return false;
    
    const confirmed = window.confirm(
      `⚠️ ${nickname} 사용자의 모든 데이터를 완전히 삭제하시겠습니까?\n` +
      `- 모든 일정\n` +
      `- 모든 태그\n` +
      `- 모든 월간 계획\n` +
      `- 모든 월간 목표\n\n` +
      `이 작업은 되돌릴 수 없습니다.`
    );
    
    if (confirmed) {
      const keysToDelete = [
        `${nickname}-schedules`,
        `${nickname}-tags`,
        `${nickname}-tagItems`,
        `${nickname}-monthlyPlans`,
        `${nickname}-monthlyGoals`,
        `${nickname}-tagTotals`
      ];
      
      keysToDelete.forEach(key => {
        if (localStorage.getItem(key)) {
          localStorage.removeItem(key);
          console.log(`  ✅ 삭제됨: ${key}`);
        }
      });
      
      alert(`✅ ${nickname} 사용자의 모든 데이터가 완전히 삭제되었습니다.`);
      window.location.reload();
      return true;
    }
    return false;
  };

  // 특정 월 데이터 삭제 함수
  const deleteMonthData = (nickname, monthKey) => {
    if (!nickname || !monthKey) return false;
    
    const confirmed = window.confirm(
      `⚠️ ${monthKey} 월의 모든 데이터를 삭제하시겠습니까?\n` +
      `- 월간 계획\n` +
      `- 월간 목표\n` +
      `- 해당 월의 모든 일정\n\n` +
      `이 작업은 되돌릴 수 없습니다.`
    );
    
    if (confirmed) {
      // 1. 해당 월의 일정들 삭제
      const schedules = loadFromLocalStorage(`${nickname}-schedules`, []);
      const filteredSchedules = schedules.filter(schedule => {
        const scheduleMonth = schedule.date.substring(0, 7);
        return scheduleMonth !== monthKey;
      });
      saveToLocalStorage(`${nickname}-schedules`, filteredSchedules);
      
      // 2. 해당 월의 월간 계획 삭제
      const monthlyPlans = loadFromLocalStorage(`${nickname}-monthlyPlans`, []);
      const filteredPlans = monthlyPlans.filter(plan => {
        // 현재 monthlyPlans 구조에 맞게 수정
        return true; // 일단 계획은 그대로 두고
      });
      
      // 3. 해당 월의 월간 목표 삭제
      const monthlyGoals = loadFromLocalStorage(`${nickname}-monthlyGoals`, []);
      const filteredGoals = monthlyGoals.filter(goal => goal.month !== monthKey);
      saveToLocalStorage(`${nickname}-monthlyGoals`, filteredGoals);
      
      console.log(`🗑️ ${monthKey} 월 데이터 삭제 완료`);
      return true;
    }
    return false;
  };

  // 월간 목표 저장 함수
  const saveMonthlyGoalsForMonth = (nickname, monthKey, goals) => {
    if (!nickname || !monthKey) return;
    
    const allGoals = loadFromLocalStorage(`${nickname}-monthlyGoals`, []);
    const existingIndex = allGoals.findIndex(goal => goal.month === monthKey);
    
    if (existingIndex >= 0) {
      allGoals[existingIndex] = { month: monthKey, goals: goals || [] };
    } else {
      allGoals.push({ month: monthKey, goals: goals || [] });
    }
    
    saveToLocalStorage(`${nickname}-monthlyGoals`, allGoals);
    console.log('🎯 월간 목표 저장 완료:', { nickname, monthKey, allGoals });
  };

  // 월간 목표 저장 함수 (빈 배열일 때도 저장해서 목표 삭제)
  const saveMonthlyGoals = (plans) => {
    if (!currentUser) return;

    // 빈 배열이면 목표도 삭제 (수정!)
    if (plans.length === 0) {
      console.log('빈 계획 배열 - 월간 목표도 삭제');
      saveMonthlyGoalsForMonth(currentUser, currentMonthKey, []);
      return;
    }

    // 태그타입별 시간 집계
    const goalsByTagType = {};
    plans.forEach(plan => {
      if (!goalsByTagType[plan.tagType]) {
        goalsByTagType[plan.tagType] = 0;
      }
      goalsByTagType[plan.tagType] += plan.estimatedTime;
    });

    // 목표 배열 생성
    const goalsArray = Object.entries(goalsByTagType).map(([tagType, totalHours]) => ({
      tagType,
      targetHours: `${totalHours.toString().padStart(2, '0')}:00`
    }));

    // 월간 목표 저장
    saveMonthlyGoalsForMonth(currentUser, currentMonthKey, goalsArray);
    console.log('월간 목표 저장:', { currentUser, currentMonthKey, goalsArray });
  };

  // 초기 데이터 로드
  useEffect(() => {
    if (!currentUser) return;

    console.log('=== MonthlyPlan 초기화 시작 ===', currentUser);

    // 계획 데이터 로드
    const storedPlans = loadFromLocalStorage(`${currentUser}-monthlyPlans`, []);
    console.log('저장된 계획 데이터:', storedPlans);
    setPlans(storedPlans);

    console.log('=== MonthlyPlan 초기화 완료 ===');
  }, [currentUser]);

  // 태그 데이터 연동을 위한 useEffect
  useEffect(() => {
    if (currentUser && safeTags.length > 0) {
      saveToLocalStorage(`${currentUser}-tags`, safeTags);
    }
  }, [safeTags, currentUser]);

  useEffect(() => {
    if (currentUser && safeTagItems.length > 0) {
      saveToLocalStorage(`${currentUser}-tagItems`, safeTagItems);
    }
  }, [safeTagItems, currentUser]);

  // 계획 변경시 저장
  useEffect(() => {
    if (currentUser && plans.length > 0) {
      saveToLocalStorage(`${currentUser}-monthlyPlans`, plans);
      saveMonthlyGoals(plans);
      console.log('월간 계획 저장:', { currentUser, plansCount: plans.length, plans });
    }
  }, [plans, currentUser]);

  const handleSelectTag = (tagType, tagName) => {
    setSelectedTagType(tagType);
    setForm((prev) => ({
      ...prev,
      tagType,
      tag: tagName
    }));
  };
  
  const handleAddTag = () => {
    if (!newTagType.trim() || !newTagName.trim()) return;
  
    const newItem = { tagType: newTagType, tagName: newTagName };
    const updatedTagItems = [...safeTagItems, newItem];
    
    if (setTagItems) {
      setTagItems(updatedTagItems);
    }

    const existingTag = safeTags.find(tag => tag.tagType === newTagType);
    if (!existingTag && setTags) {
      const newTag = {
        tagType: newTagType,
        color: getRandomTagColor()
      };
      const updatedTags = [...safeTags, newTag];
      setTags(updatedTags);
    }
  
    setNewTagType('');
    setNewTagName('');
  };
  
  const handleDeleteTagItem = (tagType, tagName) => {
    if (setTagItems) {
      const updatedTagItems = safeTagItems.filter(item => !(item.tagType === tagType && item.tagName === tagName));
      setTagItems(updatedTagItems);
    }
  };

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

  const getTagColor = (tagType) => {
    const tag = safeTags.find(t => t.tagType === tagType);
    return tag ? tag.color : { bg: 'bg-gray-100', text: 'text-gray-800', border: 'border-gray-200' };
  };

  const getGroupedPlans = () => {
    const grouped = {};
    plans.forEach(plan => {
      if (!grouped[plan.tagType]) {
        grouped[plan.tagType] = [];
      }
      grouped[plan.tagType].push(plan);
    });
    return grouped;
  };

  const handleAddPlan = () => {
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
    
    const updatedPlans = [...plans, newPlan];
    setPlans(updatedPlans);

    // 즉시 저장
    if (currentUser) {
      saveToLocalStorage(`${currentUser}-monthlyPlans`, updatedPlans);
      saveMonthlyGoals(updatedPlans);
      console.log('계획 즉시 저장 완료:', { currentUser, newPlan });
    }
  
    setForm({
      tagType: '',
      tag: '',
      name: '',
      descriptions: ['', '', ''],
      estimatedTime: ''
    });
    setSelectedTagType('');
  };
  
  const handleDeletePlan = (id) => {
    const updatedPlans = plans.filter(plan => plan.id !== id);
    setPlans(updatedPlans);

    // 즉시 저장 + 강제 목표 업데이트
    if (currentUser) {
      saveToLocalStorage(`${currentUser}-monthlyPlans`, updatedPlans);
      
      // 목표 직접 업데이트 (강제로)
      console.log('계획 삭제 후 목표 업데이트 시작');
      
      if (updatedPlans.length === 0) {
        // 모든 계획이 삭제된 경우 - 목표도 완전 삭제
        const goalsKey = `${currentUser}-monthlyGoals`;
        const allGoals = loadFromLocalStorage(goalsKey, []);
        const filteredGoals = allGoals.filter(goal => goal.month !== currentMonthKey);
        saveToLocalStorage(goalsKey, filteredGoals);
        console.log('모든 계획 삭제 - 월간 목표도 완전 삭제');
      } else {
        // 일부 계획만 삭제된 경우 - 목표 재계산
        const goalsByTagType = {};
        updatedPlans.forEach(plan => {
          if (!goalsByTagType[plan.tagType]) {
            goalsByTagType[plan.tagType] = 0;
          }
          goalsByTagType[plan.tagType] += plan.estimatedTime;
        });

        const goalsArray = Object.entries(goalsByTagType).map(([tagType, totalHours]) => ({
          tagType,
          targetHours: `${totalHours.toString().padStart(2, '0')}:00`
        }));

        // 직접 저장
        const goalsKey = `${currentUser}-monthlyGoals`;
        const allGoals = loadFromLocalStorage(goalsKey, []);
        const existingIndex = allGoals.findIndex(goal => goal.month === currentMonthKey);
        
        if (existingIndex >= 0) {
          allGoals[existingIndex] = { month: currentMonthKey, goals: goalsArray };
        } else {
          allGoals.push({ month: currentMonthKey, goals: goalsArray });
        }
        
        saveToLocalStorage(goalsKey, allGoals);
        console.log('계획 삭제 후 목표 재계산 완료:', goalsArray);
      }
      
      console.log('계획 삭제 즉시 저장 완료:', { currentUser, deletedId: id });
    }
  };

  const handleGoBack = () => {
    console.log('뒤로가기 버튼 클릭됨'); // 디버깅용
    navigate('/calendar');
  };

  const handleDataCleanup = () => {
    cleanupOrphanedData(currentUser);
    alert('✅ 데이터 정리가 완료되었습니다.');
    window.location.reload();
  };

  const groupedPlans = getGroupedPlans();

  return (
    <div className="min-h-screen flex bg-gray-50">
      {/* 왼쪽: 월간 계획 */}
      <div className="flex-1 p-6 overflow-hidden">
        <div className="bg-white rounded-lg shadow-sm p-6 h-full">
          {/* 헤더 */}
          <div className="flex items-center justify-between mb-6">
            <button
              onClick={handleGoBack}
              className="flex items-center text-gray-600 hover:text-gray-800 cursor-pointer z-10 bg-white px-2 py-1 rounded border hover:bg-gray-50 transition-colors"
            >
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              뒤로 가기
            </button>
            <div className="flex items-center gap-4">
              <h1 className="text-2xl font-bold">월간 계획 ({format(new Date(), 'yyyy년 M월')})</h1>
              {currentUser && (
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <span>🧑‍💻 {currentUser}</span>
                  <button
                    onClick={onLogout}
                    className="text-red-500 hover:text-red-700 underline"
                  >
                    로그아웃
                  </button>
                </div>
              )}
            </div>
            <div className="flex gap-2">
              {/* 데이터 정리 버튼만 남기기 */}
              <button
                onClick={handleDataCleanup}
                className="bg-yellow-100 hover:bg-yellow-200 text-yellow-700 px-3 py-2 rounded-lg text-sm font-medium transition-colors"
                title="불일치 데이터 정리"
              >
                🧹 데이터 정리
              </button>
            </div>
          </div>

          {/* 간단한 안내 메시지 */}
          <div className="mb-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
            <p className="text-blue-800 text-sm">
              <span className="font-medium">💡 팁:</span> 개별 계획을 삭제하면 월간 목표도 자동으로 업데이트됩니다.
            </p>
          </div>

          {/* 태그별 그룹화된 계획들 */}
          <div className="flex-1 overflow-y-auto">
            <div className="space-y-6">
              {Object.entries(groupedPlans).map(([tagType, tagPlans]) => {
                const colors = getTagColor(tagType);
                const totalEstimatedTime = tagPlans.reduce((sum, plan) => sum + plan.estimatedTime, 0);

                return (
                  <div key={tagType} className="flex items-start space-x-4">
                    <div className="flex flex-col items-center min-w-[120px] flex-shrink-0">
                      <div className={`px-4 py-3 rounded-lg text-lg font-semibold text-left bg-white ${colors.text} w-full border-2 ${colors.border}`}>
                        <div className="font-bold">{tagType}</div>
                        <div className="text-sm mt-1 opacity-80">
                          목표: {totalEstimatedTime}시간
                        </div>
                      </div>
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="overflow-x-auto">
                        <div className="flex space-x-4 pb-4" style={{ minWidth: 'max-content' }}>
                          {tagPlans.map((plan) => (
                            <div key={plan.id} className="w-[250px] flex-shrink-0">
                              <div className={`${colors.bg} ${colors.border} border rounded-lg p-3 relative`}>
                                <div className="flex justify-between items-center mb-2">
                                  <span className={`font-medium ${colors.text}`}>{plan.tag}</span>
                                  <div className="flex items-center gap-2">
                                    <span className={`text-sm ${colors.text}`}>{plan.estimatedTime}시간</span>
                                    <button
                                      onClick={() => handleDeletePlan(plan.id)}
                                      className="text-red-400 hover:text-red-600 text-sm"
                                      title="이 계획 삭제"
                                    >
                                      ×
                                    </button>
                                  </div>
                                </div>
                                {plan.description && (
                                  <div className={`text-sm ${colors.text} opacity-75`}>
                                    {plan.description.split(', ').map((item, idx) => (
                                      <div key={idx}>• {item}</div>
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
              
              {Object.keys(groupedPlans).length === 0 && (
                <div className="text-center py-12 text-gray-500">
                  <h3 className="text-xl font-medium mb-2">등록된 월간 계획이 없습니다</h3>
                  <p className="text-sm mb-4">오른쪽 패널에서 새로운 계획을 추가해보세요!</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 오른쪽: 계획 추가 폼 */}
      <div className="w-96 border-l border-gray-200 bg-white p-6">
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
              />
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
                className="w-full py-2 text-sm bg-gray-100 rounded-md hover:bg-gray-200 text-gray-700"
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

                  return (
                    <div key={idx} className="flex items-center mb-2 last:mb-0">
                      <div className={`w-16 ${tagColor.bg} ${tagColor.text} px-2 py-1 rounded-l-md text-xs font-medium truncate`}>
                        {item.tagType}
                      </div>
                      <div
                        className={`flex-1 ${tagColor.bg} ${tagColor.text} px-2 py-1 text-xs cursor-pointer hover:bg-opacity-80 
                          ${selectedTagType === item.tagType && form.tag === item.tagName ? 'ring-1 ring-blue-400' : ''}`}
                        onClick={() => handleSelectTag(item.tagType, item.tagName)}
                      >
                        {item.tagName}
                      </div>
                      <button
                        className="bg-red-100 text-red-500 rounded-r-md px-2 py-1 text-xs"
                        onClick={() => handleDeleteTagItem(item.tagType, item.tagName)}
                      >
                        ×
                      </button>
                    </div>
                  );
                })}
                {safeTagItems.length === 0 && (
                  <div className="text-center text-gray-500 py-15 text-sm">
                    태그를 추가해주세요
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
                onChange={(e) => setNewTagType(e.target.value)}
              />
              <input
                type="text"
                placeholder="항목 이름"
                className="flex-1 text-xs bg-white border-y border-r-0 px-2 py-1 focus:outline-none focus:border-gray-400"
                value={newTagName}
                onChange={(e) => setNewTagName(e.target.value)}
              />
              <button
                className="bg-gray-200 w-8 h-6 rounded-r-md flex items-center justify-center text-sm font-bold"
                onClick={handleAddTag}
              >
                +
              </button>
            </div>

            <button
              className="w-full bg-green-100 text-center py-3 rounded-lg text-xl font-medium text-green-800"
              onClick={handleAddPlan}
            >
              일정 추가하기
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MonthlyPlan;