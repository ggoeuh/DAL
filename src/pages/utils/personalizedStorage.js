// utils/personalizedStorage.js - 사용자별 개인화된 스토리지
const saveToStorage = (key, data) => {
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch (error) {
    console.error(`${key} 저장 실패:`, error);
  }
};

const loadFromStorage = (key, defaultValue = []) => {
  try {
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : defaultValue;
  } catch (error) {
    console.error(`${key} 불러오기 실패:`, error);
    return defaultValue;
  }
};

// =========================
// 사용자별 키 생성 함수
// =========================
const getUserKey = (nickname, type) => {
  if (!nickname) return null;
  return `${nickname}-${type}`;
};

// =========================
// ✅ 일정 관련 함수들
// =========================
export const saveSchedulesToStorage = (nickname, schedules) => {
  const key = getUserKey(nickname, 'weekly-calendar-schedules');
  if (key) saveToStorage(key, schedules);
};

export const loadSchedulesFromStorage = (nickname) => {
  const key = getUserKey(nickname, 'weekly-calendar-schedules');
  return key ? loadFromStorage(key) : [];
};

// =========================
// ✅ 태그 그룹 관련 함수들
// =========================
export const saveTagsToStorage = (nickname, tags) => {
  const key = getUserKey(nickname, 'weekly-calendar-tags');
  if (key) saveToStorage(key, tags);
};

export const loadTagsFromStorage = (nickname) => {
  const key = getUserKey(nickname, 'weekly-calendar-tags');
  return key ? loadFromStorage(key) : [];
};

// =========================
// ✅ 태그 항목 관련 함수들
// =========================
export const saveTagItemsToStorage = (nickname, tagItems) => {
  const key = getUserKey(nickname, 'weekly-calendar-tag-items');
  if (key) saveToStorage(key, tagItems);
};

export const loadTagItemsFromStorage = (nickname) => {
  const key = getUserKey(nickname, 'weekly-calendar-tag-items');
  return key ? loadFromStorage(key) : [];
};

// =========================
// ✅ 누적 시간 관련 함수들
// =========================
export const saveTagTotalsToStorage = (nickname, tagTotals) => {
  const key = getUserKey(nickname, 'weekly-calendar-tag-totals');
  if (key) saveToStorage(key, tagTotals);
};

export const loadTagTotalsFromStorage = (nickname) => {
  const key = getUserKey(nickname, 'weekly-calendar-tag-totals');
  return key ? loadFromStorage(key, {}) : {};
};

// =========================
// ✅ 월간 계획 관련 함수들
// =========================
export const saveMonthlyPlansToStorage = (nickname, plans) => {
  const key = getUserKey(nickname, 'monthly-plans');
  if (key) saveToStorage(key, plans);
};

export const loadMonthlyPlansFromStorage = (nickname) => {
  const key = getUserKey(nickname, 'monthly-plans');
  return key ? loadFromStorage(key) : [];
};

// =========================
// ✅ 월별 목표 관련 함수들
// =========================
export const saveMonthlyGoalsToStorage = (nickname, goals) => {
  const key = getUserKey(nickname, 'monthly-goals');
  if (key) saveToStorage(key, goals);
};

export const loadMonthlyGoalsFromStorage = (nickname) => {
  const key = getUserKey(nickname, 'monthly-goals');
  return key ? loadFromStorage(key) : [];
};

// =========================
// ✅ 특정 월의 목표 관련 함수들
// =========================
export const getMonthlyGoalsForMonth = (nickname, monthKey) => {
  if (!nickname || !monthKey) return [];
  
  const allGoals = loadMonthlyGoalsFromStorage(nickname);
  return allGoals.find(goal => goal.month === monthKey)?.goals || [];
};

export const saveMonthlyGoalsForMonth = (nickname, monthKey, goals) => {
  if (!nickname || !monthKey) return;
  
  const allGoals = loadMonthlyGoalsFromStorage(nickname);
  const existingIndex = allGoals.findIndex(goal => goal.month === monthKey);
  
  if (existingIndex >= 0) {
    allGoals[existingIndex] = { month: monthKey, goals };
  } else {
    allGoals.push({ month: monthKey, goals });
  }
  
  saveMonthlyGoalsToStorage(nickname, allGoals);
};

// =========================
// ✅ 통합 데이터 관리 함수들
// =========================

// 사용자의 모든 데이터 불러오기
export const loadAllUserData = (nickname) => {
  if (!nickname) return null;
  
  return {
    schedules: loadSchedulesFromStorage(nickname),
    tags: loadTagsFromStorage(nickname),
    tagItems: loadTagItemsFromStorage(nickname),
    tagTotals: loadTagTotalsFromStorage(nickname),
    monthlyPlans: loadMonthlyPlansFromStorage(nickname),
    monthlyGoals: loadMonthlyGoalsFromStorage(nickname)
  };
};

// 사용자의 핵심 데이터 저장하기 (앱에서 주로 사용)
export const saveUserCoreData = (nickname, { schedules, tags, tagItems }) => {
  if (!nickname) return;
  
  saveSchedulesToStorage(nickname, schedules || []);
  saveTagsToStorage(nickname, tags || []);
  saveTagItemsToStorage(nickname, tagItems || []);
};

// 사용자 데이터 초기화 (로그아웃 시 사용)
export const clearUserData = (nickname) => {
  if (!nickname) return;
  
  const keysToRemove = [
    getUserKey(nickname, 'weekly-calendar-schedules'),
    getUserKey(nickname, 'weekly-calendar-tags'),
    getUserKey(nickname, 'weekly-calendar-tag-items'),
    getUserKey(nickname, 'weekly-calendar-tag-totals'),
    getUserKey(nickname, 'monthly-plans'),
    getUserKey(nickname, 'monthly-goals')
  ];
  
  keysToRemove.forEach(key => {
    if (key) {
      try {
        localStorage.removeItem(key);
      } catch (error) {
        console.error(`${key} 삭제 실패:`, error);
      }
    }
  });
  
  console.log('사용자 데이터 초기화 완료:', nickname);
};

// =========================
// ✅ 디버깅/관리용 함수들
// =========================

// 모든 사용자 키 조회 (디버깅용)
export const getAllUserKeys = () => {
  const keys = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && (key.includes('minji-') || key.includes('taejun-') || key.includes('hyeonseo-'))) {
      keys.push(key);
    }
  }
  return keys;
};

// 특정 사용자의 모든 키 조회
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

// 스토리지 사용량 체크 (디버깅용)
export const getStorageInfo = (nickname) => {
  if (!nickname) return null;
  
  const userKeys = getUserKeys(nickname);
  let totalSize = 0;
  const keyInfo = {};
  
  userKeys.forEach(key => {
    const data = localStorage.getItem(key);
    const size = data ? data.length : 0;
    totalSize += size;
    keyInfo[key] = {
      size: size,
      sizeKB: (size / 1024).toFixed(2)
    };
  });
  
  return {
    nickname,
    totalKeys: userKeys.length,
    totalSize,
    totalSizeKB: (totalSize / 1024).toFixed(2),
    keyInfo
  };
};