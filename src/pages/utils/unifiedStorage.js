// utils/unifiedStorage.js - 통합된 스토리지 시스템 (서버 연동 포함)

const SERVER_URL = 'https://mellow-cobbler-97a3f1.netlify.app/.netlify/functions/save_data';

// =========================
// 🌐 서버 연동 함수들 (최우선)
// =========================

// 서버에서 데이터 불러오기
export const loadFromServer = async (nickname) => {
  if (!nickname) {
    console.error('❌ 서버 불러오기 실패: 사용자명이 없습니다');
    return null;
  }

  try {
    console.log('🌐 서버에서 데이터 불러오기 시작:', nickname);
    
    const response = await fetch(`${SERVER_URL}?user_id=${encodeURIComponent(nickname)}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      mode: 'cors'
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const data = await response.json();
    console.log('✅ 서버에서 데이터 불러오기 성공:', nickname, data);
    
    // 데이터 구조 검증 및 기본값 보장
    const validatedData = {
      schedules: Array.isArray(data?.schedules) ? data.schedules : [],
      tags: Array.isArray(data?.tags) ? data.tags : [],
      tagItems: Array.isArray(data?.tagItems) ? data.tagItems : [],
      monthlyPlans: Array.isArray(data?.monthlyPlans) ? data.monthlyPlans : [],
      monthlyGoals: Array.isArray(data?.monthlyGoals) ? data.monthlyGoals : [],
      lastUpdated: data?.lastUpdated || new Date().toISOString()
    };
    
    return validatedData;
    
  } catch (error) {
    console.error('❌ 서버에서 데이터 불러오기 실패:', error);
    return null;
  }
};

// 서버에 데이터 저장
export const saveToServer = async (nickname, data) => {
  if (!nickname) {
    console.error('❌ 서버 저장 실패: 사용자명이 없습니다');
    return false;
  }

  try {
    console.log('🌐 서버에 데이터 저장 시작:', nickname);
    
    const dataToSave = {
      schedules: data?.schedules || [],
      tags: data?.tags || [],
      tagItems: data?.tagItems || [],
      monthlyPlans: data?.monthlyPlans || [],
      monthlyGoals: data?.monthlyGoals || [],
      lastUpdated: new Date().toISOString()
    };
    
    const response = await fetch(`${SERVER_URL}?user_id=${encodeURIComponent(nickname)}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      mode: 'cors',
      body: JSON.stringify(dataToSave)
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(`HTTP ${response.status}: ${errorData.error || response.statusText}`);
    }
    
    const result = await response.json();
    console.log('✅ 서버에 데이터 저장 성공:', nickname, result);
    
    return true;
    
  } catch (error) {
    console.error('❌ 서버에 데이터 저장 실패:', error);
    return false;
  }
};

// =========================
// 💾 로컬 스토리지 함수들
// =========================

const saveToStorage = (key, data) => {
  try {
    localStorage.setItem(key, JSON.stringify(data));
    console.log(`💾 로컬 저장 완료: ${key}`);
  } catch (error) {
    console.error(`❌ 로컬 저장 실패: ${key}`, error);
  }
};

const loadFromStorage = (key, defaultValue = []) => {
  try {
    const data = localStorage.getItem(key);
    if (!data) {
      return defaultValue;
    }
    
    const result = JSON.parse(data);
    return result;
  } catch (error) {
    console.error(`❌ 로컬 불러오기 실패: ${key}`, error);
    
    // 손상된 데이터 삭제
    try {
      localStorage.removeItem(key);
      console.log(`🗑️ 손상된 데이터 삭제: ${key}`);
    } catch (e) {
      console.error('손상된 데이터 삭제 실패:', e);
    }
    
    return defaultValue;
  }
};

// 사용자별 키 생성
const getUserKey = (nickname, type) => {
  if (!nickname) return null;
  return `${nickname}-${type}`;
};

// =========================
// ✅ 통합 데이터 관리 함수들
// =========================

// 사용자의 모든 데이터 불러오기 (서버 우선, 로컬 백업)
export const loadAllUserData = async (nickname) => {
  if (!nickname) return null;
  
  console.log('📦 전체 사용자 데이터 불러오기 시작:', nickname);
  
  try {
    // 1. 서버에서 데이터 시도
    const serverData = await loadFromServer(nickname);
    
    if (serverData) {
      console.log('✅ 서버 데이터 사용:', nickname);
      
      // 서버 데이터를 로컬에도 백업
      saveToLocalStorage(nickname, serverData);
      
      return serverData;
    } else {
      console.log('⚠️ 서버 데이터 없음, 로컬 데이터 확인:', nickname);
    }
  } catch (error) {
    console.error('❌ 서버 데이터 로드 실패:', error);
  }
  
  // 2. 서버 실패 시 로컬 데이터 사용
  try {
    const localData = {
      schedules: loadSchedulesFromStorage(nickname),
      tags: loadTagsFromStorage(nickname),
      tagItems: loadTagItemsFromStorage(nickname),
      monthlyPlans: loadMonthlyPlansFromStorage(nickname),
      monthlyGoals: loadMonthlyGoalsFromStorage(nickname)
    };
    
    console.log('📦 로컬 데이터 사용:', nickname, localData);
    return localData;
  } catch (error) {
    console.error('❌ 로컬 데이터 로드도 실패:', error);
  }
  
  // 3. 모든 것 실패 시 기본 데이터
  console.log('📦 기본 데이터 사용:', nickname);
  return {
    schedules: [],
    tags: [],
    tagItems: [],
    monthlyPlans: [],
    monthlyGoals: []
  };
};

// 사용자의 핵심 데이터 저장하기 (서버 + 로컬)
export const saveUserCoreData = async (nickname, { schedules, tags, tagItems, monthlyPlans, monthlyGoals }) => {
  if (!nickname) return false;
  
  console.log('📦 핵심 사용자 데이터 저장 시작:', nickname);
  
  const dataToSave = {
    schedules: schedules || [],
    tags: tags || [],
    tagItems: tagItems || [],
    monthlyPlans: monthlyPlans || [],
    monthlyGoals: monthlyGoals || []
  };
  
  // 1. 로컬에 즉시 저장 (빠른 응답)
  try {
    saveSchedulesToStorage(nickname, dataToSave.schedules);
    saveTagsToStorage(nickname, dataToSave.tags);
    saveTagItemsToStorage(nickname, dataToSave.tagItems);
    saveMonthlyPlansToStorage(nickname, dataToSave.monthlyPlans);
    saveMonthlyGoalsToStorage(nickname, dataToSave.monthlyGoals);
    console.log('✅ 로컬 저장 완료');
  } catch (error) {
    console.error('❌ 로컬 저장 실패:', error);
  }
  
  // 2. 서버에 백그라운드 저장
  try {
    const serverSuccess = await saveToServer(nickname, dataToSave);
    if (serverSuccess) {
      console.log('✅ 서버 저장 완료');
    } else {
      console.log('⚠️ 서버 저장 실패, 로컬에만 저장됨');
    }
    return serverSuccess;
  } catch (error) {
    console.error('❌ 서버 저장 실패:', error);
    return false;
  }
};

// =========================
// ✅ 개별 데이터 타입별 함수들
// =========================

export const saveSchedulesToStorage = (nickname, schedules) => {
  const key = getUserKey(nickname, 'schedules');
  if (key) saveToStorage(key, schedules || []);
};

export const loadSchedulesFromStorage = (nickname) => {
  const key = getUserKey(nickname, 'schedules');
  return key ? loadFromStorage(key, []) : [];
};

export const saveTagsToStorage = (nickname, tags) => {
  const key = getUserKey(nickname, 'tags');
  if (key) saveToStorage(key, tags || []);
};

export const loadTagsFromStorage = (nickname) => {
  const key = getUserKey(nickname, 'tags');
  return key ? loadFromStorage(key, []) : [];
};

export const saveTagItemsToStorage = (nickname, tagItems) => {
  const key = getUserKey(nickname, 'tagItems');
  if (key) saveToStorage(key, tagItems || []);
};

export const loadTagItemsFromStorage = (nickname) => {
  const key = getUserKey(nickname, 'tagItems');
  return key ? loadFromStorage(key, []) : [];
};

export const saveMonthlyPlansToStorage = (nickname, plans) => {
  const key = getUserKey(nickname, 'monthlyPlans');
  if (key) saveToStorage(key, plans || []);
};

export const loadMonthlyPlansFromStorage = (nickname) => {
  const key = getUserKey(nickname, 'monthlyPlans');
  return key ? loadFromStorage(key, []) : [];
};

export const saveMonthlyGoalsToStorage = (nickname, goals) => {
  const key = getUserKey(nickname, 'monthlyGoals');
  if (key) saveToStorage(key, goals || []);
};

export const loadMonthlyGoalsFromStorage = (nickname) => {
  const key = getUserKey(nickname, 'monthlyGoals');
  return key ? loadFromStorage(key, []) : [];
};

// =========================
// 🔄 서버 백업/복원 함수들
// =========================

// 현재 로컬 데이터를 서버에 백업
export const backupToServer = async (nickname) => {
  if (!nickname) return false;

  try {
    console.log('📤 서버 백업 시작:', nickname);
    
    const localData = {
      schedules: loadSchedulesFromStorage(nickname),
      tags: loadTagsFromStorage(nickname),
      tagItems: loadTagItemsFromStorage(nickname),
      monthlyPlans: loadMonthlyPlansFromStorage(nickname),
      monthlyGoals: loadMonthlyGoalsFromStorage(nickname)
    };
    
    const success = await saveToServer(nickname, localData);
    
    if (success) {
      console.log('✅ 서버 백업 완료:', nickname);
      return true;
    } else {
      throw new Error('서버 저장 실패');
    }
  } catch (error) {
    console.error('❌ 서버 백업 실패:', error);
    return false;
  }
};

// 서버에서 데이터를 복원하여 로컬에 덮어쓰기
export const restoreFromServer = async (nickname) => {
  if (!nickname) return false;

  try {
    console.log('📥 서버 복원 시작:', nickname);
    
    const serverData = await loadFromServer(nickname);
    
    if (!serverData) {
      console.log('📭 서버에 백업된 데이터가 없습니다:', nickname);
      return false;
    }

    // 로컬에 복원
    if (serverData.schedules) saveSchedulesToStorage(nickname, serverData.schedules);
    if (serverData.tags) saveTagsToStorage(nickname, serverData.tags);
    if (serverData.tagItems) saveTagItemsToStorage(nickname, serverData.tagItems);
    if (serverData.monthlyPlans) saveMonthlyPlansToStorage(nickname, serverData.monthlyPlans);
    if (serverData.monthlyGoals) saveMonthlyGoalsToStorage(nickname, serverData.monthlyGoals);

    console.log('✅ 서버에서 복원 완료:', nickname);
    return true;
  } catch (error) {
    console.error('❌ 서버 복원 실패:', error);
    return false;
  }
};

// =========================
// 🗑️ 데이터 초기화 함수들
// =========================

export const resetUserData = (nickname) => {
  if (!nickname) return false;
  
  const keysToDelete = [
    `${nickname}-schedules`,
    `${nickname}-tags`,
    `${nickname}-tagItems`,
    `${nickname}-monthlyPlans`,
    `${nickname}-monthlyGoals`,
    `${nickname}-tagTotals`
  ];
  
  keysToDelete.forEach(key => {
    try {
      localStorage.removeItem(key);
      console.log(`✅ 삭제됨: ${key}`);
    } catch (error) {
      console.error(`❌ 삭제 실패: ${key}`, error);
    }
  });
  
  console.log(`🗑️ ${nickname} 사용자 데이터 초기화 완료`);
  return true;
};

// =========================
// 🌐 브라우저 콘솔 유틸리티
// =========================

if (typeof window !== 'undefined') {
  window.storageUtils = {
    // 서버 관련
    backup: async (nickname) => {
      if (!nickname) {
        console.log('사용법: storageUtils.backup("사용자명")');
        return;
      }
      const success = await backupToServer(nickname);
      if (success) {
        alert('✅ 서버 백업 완료!');
      } else {
        alert('❌ 서버 백업 실패!');
      }
      return success;
    },
    
    restore: async (nickname) => {
      if (!nickname) {
        console.log('사용법: storageUtils.restore("사용자명")');
        return;
      }
      if (confirm('⚠️ 서버에서 데이터를 복원하시겠습니까?\n현재 로컬 데이터가 덮어쓰여집니다.')) {
        const success = await restoreFromServer(nickname);
        if (success) {
          alert('✅ 서버 복원 완료! 페이지를 새로고침합니다.');
          window.location.reload();
        } else {
          alert('❌ 서버 복원 실패!');
        }
        return success;
      }
      return false;
    },
    
    // 초기화
    resetUser: (nickname) => {
      if (!nickname) {
        console.log('사용법: storageUtils.resetUser("사용자명")');
        return;
      }
      if (confirm(`⚠️ ${nickname} 사용자의 모든 로컬 데이터를 삭제하시겠습니까?`)) {
        const success = resetUserData(nickname);
        if (success) {
          alert('✅ 사용자 데이터 초기화 완료!');
          window.location.reload();
        }
        return success;
      }
      return false;
    },
    
    // 디버깅
    showAllKeys: () => {
      console.log('📋 현재 localStorage의 모든 키:');
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        const data = localStorage.getItem(key);
        try {
          console.log(`  ${key}:`, JSON.parse(data || 'null'));
        } catch (e) {
          console.log(`  ${key}: [파싱 실패] ${data}`);
        }
      }
    },
    
    // 서버 상태 확인
    checkServer: async () => {
      try {
        const response = await fetch(SERVER_URL, { 
          method: 'OPTIONS',
          mode: 'cors'
        });
        console.log('🌐 서버 상태:', response.ok ? '✅ 정상' : '❌ 오류');
        return response.ok;
      } catch (error) {
        console.log('🌐 서버 상태: ❌ 연결 실패', error);
        return false;
      }
    }
  };
  
  console.log('🔧 서버 연동 스토리지 유틸리티가 준비되었습니다!');
  console.log('사용법:');
  console.log('  storageUtils.backup("사용자명") - 서버 백업');
  console.log('  storageUtils.restore("사용자명") - 서버 복원');
  console.log('  storageUtils.checkServer() - 서버 상태 확인');
}

// =========================
// 🔗 기존 함수들 호환성 유지
// =========================

export const saveToLocalStorage = (nickname, data) => {
  try {
    const key = `${nickname}_backup`;
    localStorage.setItem(key, JSON.stringify(data));
    console.log('💾 로컬 백업 저장 완료');
  } catch (error) {
    console.error('❌ 로컬 백업 저장 실패:', error);
  }
};

export const loadFromLocalStorage = (nickname) => {
  try {
    const key = `${nickname}_backup`;
    const data = localStorage.getItem(key);
    if (data) {
      const parsed = JSON.parse(data);
      console.log('✅ 로컬 백업에서 데이터 로드');
      return parsed;
    }
  } catch (error) {
    console.error('❌ 로컬 백업 로드 실패:', error);
  }
  return null;
};

// 월간 목표 관련 특별 함수들
export const saveMonthlyGoalsForMonth = async (nickname, monthKey, goals) => {
  if (!nickname || !monthKey) return false;
  
  console.log('🎯 월간 목표 저장 시도:', { nickname, monthKey, goals });
  
  const allGoals = loadMonthlyGoalsFromStorage(nickname);
  const existingIndex = allGoals.findIndex(goal => goal.month === monthKey);
  
  if (existingIndex >= 0) {
    allGoals[existingIndex] = { month: monthKey, goals: goals || [] };
  } else {
    allGoals.push({ month: monthKey, goals: goals || [] });
  }
  
  // 로컬 저장
  saveMonthlyGoalsToStorage(nickname, allGoals);
  
  // 서버 저장 (백그라운드)
  try {
    const currentData = await loadAllUserData(nickname);
    currentData.monthlyGoals = allGoals;
    await saveToServer(nickname, currentData);
    console.log('🎯 월간 목표 서버 저장 완료');
  } catch (error) {
    console.error('❌ 월간 목표 서버 저장 실패:', error);
  }
  
  console.log('🎯 월간 목표 저장 완료:', { nickname, monthKey, allGoals });
  return true;
};

export const getMonthlyGoalsForMonth = (nickname, monthKey) => {
  if (!nickname || !monthKey) return [];
  
  console.log('🎯 월간 목표 불러오기 시도:', { nickname, monthKey });
  
  const allGoals = loadMonthlyGoalsFromStorage(nickname);
  const found = allGoals.find(goal => goal.month === monthKey);
  const result = found?.goals || [];
  
  console.log('🎯 월간 목표 불러오기 완료:', { nickname, monthKey, resultCount: result.length });
  
  return result;
};

// 통합 데이터 로딩 (서버 우선, 로컬 백업)
export const loadUserDataWithFallback = async (nickname) => {
  try {
    console.log('📦 통합 데이터 로딩 시작:', nickname);
    
    // 1. 서버에서 데이터 로드 시도
    const serverData = await loadFromServer(nickname);
    
    if (serverData) {
      console.log('✅ 서버 데이터 사용:', nickname);
      
      // 서버 데이터를 로컬에도 백업 저장
      saveToLocalStorage(nickname, serverData);
      return serverData;
    }
    
    console.log('⚠️ 서버 데이터 없음, 로컬 데이터 확인:', nickname);
  } catch (error) {
    console.warn('⚠️ 서버 로드 실패, 로컬 백업 시도:', error);
  }
  
  // 2. 서버 실패 시 로컬 백업 사용
  const localBackup = loadFromLocalStorage(nickname);
  if (localBackup) {
    console.log('✅ 로컬 백업 데이터 사용:', nickname);
    return localBackup;
  }
  
  // 3. 로컬 개별 스토리지에서 로드
  const localData = {
    schedules: loadSchedulesFromStorage(nickname),
    tags: loadTagsFromStorage(nickname),
    tagItems: loadTagItemsFromStorage(nickname),
    monthlyPlans: loadMonthlyPlansFromStorage(nickname),
    monthlyGoals: loadMonthlyGoalsFromStorage(nickname)
  };
  
  console.log('✅ 로컬 개별 데이터 사용:', nickname);
  return localData;
};

// 데이터 정리 및 검증 함수
export const cleanupCorruptedData = () => {
  console.log('🧹 손상된 데이터 정리 시작');
  
  const keysToCheck = [];
  for (let i = 0; i < localStorage.length; i++) {
    keysToCheck.push(localStorage.key(i));
  }
  
  keysToCheck.forEach(key => {
    if (!key) return;
    
    const rawData = localStorage.getItem(key);
    if (!rawData) return;
    
    try {
      JSON.parse(rawData);
      // 파싱 성공하면 유효한 데이터
    } catch (parseError) {
      console.log(`🗑️ 손상된 데이터 삭제: ${key}`, { rawData, parseError });
      localStorage.removeItem(key);
    }
  });
  
  console.log('🧹 손상된 데이터 정리 완료');
};

// 사용자별 키 목록 가져오기
export const getUserKeys = (nickname) => {
  if (!nickname) return [];
  
  const keys = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith(`${nickname}-`)) {
      keys.push(key);
    }
  }
  return keys;
};

// 디버깅용 함수
export const debugStorage = (nickname) => {
  console.log('🔍 스토리지 디버깅:', nickname);
  
  // 모든 localStorage 키 확인
  console.log('📋 모든 localStorage 키들:');
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    const rawData = localStorage.getItem(key);
    
    try {
      const parsedData = JSON.parse(rawData || 'null');
      console.log(`  ✅ ${key}:`, parsedData);
    } catch (parseError) {
      console.log(`  ❌ ${key}: [JSON 파싱 실패]`, { rawData, parseError });
      
      // 손상된 데이터라면 삭제 여부 확인
      if (rawData && rawData.length > 0) {
        console.log(`  🗑️ 손상된 데이터 발견: ${key} - 삭제 권장`);
      }
    }
  }
  
  // 사용자별 키들
  const userKeys = getUserKeys(nickname);
  console.log('👤 사용자별 키들:', userKeys);
  
  // 서버 상태 확인
  window.storageUtils?.checkServer?.();
};