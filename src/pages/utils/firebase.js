// firebase.js - 개발용 fallback 포함
import { initializeApp } from 'firebase/app';
import { getFirestore, doc, setDoc, getDoc } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
};

// Firebase 설정이 실제 값인지 확인
const isFirebaseConfigured = firebaseConfig.apiKey !== "YOUR_API_KEY";

let db = null;

if (isFirebaseConfigured) {
  try {
    const app = initializeApp(firebaseConfig);
    db = getFirestore(app);
    console.log('✅ Firebase 연결 성공');
  } catch (error) {
    console.error('❌ Firebase 연결 실패:', error);
  }
} else {
  console.log('⚠️ Firebase 설정이 없습니다. 로컬 스토리지를 사용합니다.');
}

// =========================
// 로컬 스토리지 fallback 함수들
// =========================

import { 
  saveSchedulesToStorage, 
  saveTagsToStorage,
  saveTagItemsToStorage,
  loadSchedulesFromStorage, 
  loadTagsFromStorage, 
  loadTagItemsFromStorage,
  saveMonthlyGoalsForMonth,
  getMonthlyGoalsForMonth
} from './personalizedStorage.js';

const saveToLocalStorage = (key, data) => {
  try {
    localStorage.setItem(key, JSON.stringify(data));
    return true;
  } catch (error) {
    console.error('로컬 스토리지 저장 실패:', error);
    return false;
  }
};

const loadFromLocalStorage = (key, defaultValue = null) => {
  try {
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : defaultValue;
  } catch (error) {
    console.error('로컬 스토리지 불러오기 실패:', error);
    return defaultValue;
  }
};

// =========================
// 일정 관련 함수들
// =========================

export const saveSchedules = async (nickname, schedules) => {
  if (!nickname || !schedules) return;
  
  if (isFirebaseConfigured && db) {
    try {
      await setDoc(doc(db, `users`, `${nickname}_schedules`), { 
        schedules,
        updatedAt: new Date().toISOString()
      });
      console.log('✅ Firebase 일정 저장 완료:', nickname);
    } catch (error) {
      console.error('❌ Firebase 일정 저장 실패:', error);
      // Firebase 실패시 개인화된 로컬 스토리지로 fallback
      saveUserCoreData(nickname, { schedules, tags: [], tagItems: [] });
    }
  } else {
    // 로컬 스토리지 사용
    saveToLocalStorage(`${nickname}_schedules`, schedules);
    console.log('💾 로컬 일정 저장 완료:', nickname);
  }
};

export const loadSchedules = async (nickname) => {
  if (!nickname) return [];
  
  if (isFirebaseConfigured && db) {
    try {
      const snap = await getDoc(doc(db, `users`, `${nickname}_schedules`));
      if (snap.exists()) {
        console.log('✅ Firebase 일정 불러오기 완료:', nickname);
        return snap.data().schedules;
      } else {
        console.log('📭 Firebase에 일정 데이터 없음 (신규 유저):', nickname);
        return [];
      }
    } catch (error) {
      console.error('❌ Firebase 일정 불러오기 실패:', error);
      // Firebase 실패시 로컬 스토리지로 fallback
      return loadFromLocalStorage(`${nickname}_schedules`, []);
    }
  } else {
    // 로컬 스토리지 사용
    const schedules = loadFromLocalStorage(`${nickname}_schedules`, []);
    console.log('💾 로컬 일정 불러오기 완료:', nickname, schedules.length, '개');
    return schedules;
  }
};

// =========================
// 태그 관련 함수들
// =========================

export const saveTags = async (nickname, tags, tagItems) => {
  if (!nickname) return;
  
  const tagData = {
    tags: tags || [],
    tagItems: tagItems || []
  };
  
  if (isFirebaseConfigured && db) {
    try {
      await setDoc(doc(db, `users`, `${nickname}_tags`), { 
        ...tagData,
        updatedAt: new Date().toISOString()
      });
      console.log('✅ Firebase 태그 저장 완료:', nickname);
    } catch (error) {
      console.error('❌ Firebase 태그 저장 실패:', error);
      // Firebase 실패시 개인화된 로컬 스토리지로 fallback
      saveTagsToStorage(nickname, tags);
      saveTagItemsToStorage(nickname, tagItems);
    }
  } else {
    // 로컬 스토리지 사용 (개인화된 스토리지 함수 사용)
    saveTagsToStorage(nickname, tags);
    saveTagItemsToStorage(nickname, tagItems);
    console.log('💾 로컬 태그 저장 완료:', nickname);
  }
};

export const loadTags = async (nickname) => {
  if (!nickname) return { tags: [], tagItems: [] };
  
  if (isFirebaseConfigured && db) {
    try {
      const snap = await getDoc(doc(db, `users`, `${nickname}_tags`));
      if (snap.exists()) {
        console.log('✅ Firebase 태그 불러오기 완료:', nickname);
        return snap.data();
      } else {
        console.log('📭 Firebase에 태그 데이터 없음 (신규 유저):', nickname);
        return { tags: [], tagItems: [] };
      }
    } catch (error) {
      console.error('❌ Firebase 태그 불러오기 실패:', error);
      // Firebase 실패시 개인화된 로컬 스토리지로 fallback
      return {
        tags: loadTagsFromStorage(nickname),
        tagItems: loadTagItemsFromStorage(nickname)
      };
    }
  } else {
    // 로컬 스토리지 사용 (개인화된 스토리지 함수 사용)
    const tags = loadTagsFromStorage(nickname);
    const tagItems = loadTagItemsFromStorage(nickname);
    console.log('💾 로컬 태그 불러오기 완료:', nickname);
    return { tags, tagItems };
  }
};

// =========================
// 월간 계획 관련 함수들
// =========================

export const saveMonthlyPlans = async (nickname, month, goals) => {
  if (!nickname || !month || !goals) return;
  
  if (isFirebaseConfigured && db) {
    try {
      await setDoc(doc(db, `monthlyPlans`, `${nickname}_${month}`), { 
        goals,
        updatedAt: new Date().toISOString()
      });
      console.log('✅ Firebase 월간 계획 저장 완료:', nickname, month);
    } catch (error) {
      console.error('❌ Firebase 월간 계획 저장 실패:', error);
      // Firebase 실패시 개인화된 로컬 스토리지로 fallback
      saveMonthlyGoalsForMonth(nickname, month, goals);
    }
  } else {
    // 로컬 스토리지 사용 (개인화된 스토리지 함수 사용)
    saveMonthlyGoalsForMonth(nickname, month, goals);
    console.log('💾 로컬 월간 계획 저장 완료:', nickname, month);
  }
};

export const loadMonthlyPlans = async (nickname, month) => {
  if (!nickname || !month) return { goals: [] };
  
  if (isFirebaseConfigured && db) {
    try {
      const snap = await getDoc(doc(db, `monthlyPlans`, `${nickname}_${month}`));
      if (snap.exists()) {
        console.log('✅ Firebase 월간 계획 불러오기 완료:', nickname, month);
        return snap.data();
      } else {
        console.log('📭 Firebase에 월간 계획 없음:', nickname, month);
        return { goals: [] };
      }
    } catch (error) {
      console.error('❌ Firebase 월간 계획 불러오기 실패:', error);
      // Firebase 실패시 개인화된 로컬 스토리지로 fallback
      return { goals: getMonthlyGoalsForMonth(nickname, month) };
    }
  } else {
    // 로컬 스토리지 사용 (개인화된 스토리지 함수 사용)
    const goals = getMonthlyGoalsForMonth(nickname, month);
    console.log('💾 로컬 월간 계획 불러오기 완료:', nickname, month);
    return { goals };
  }
};

// =========================
// 통합 함수들
// =========================

export const loadUserData = async (nickname) => {
  if (!nickname) return null;
  
  try {
    const [schedules, tagsData] = await Promise.all([
      loadSchedules(nickname),
      loadTags(nickname)
    ]);
    
    return {
      schedules,
      tags: tagsData.tags,
      tagItems: tagsData.tagItems
    };
  } catch (error) {
    console.error('사용자 데이터 불러오기 실패:', error);
    return {
      schedules: [],
      tags: [],
      tagItems: []
    };
  }
};

export const saveUserData = async (nickname, { schedules, tags, tagItems }) => {
  if (!nickname) return;
  
  try {
    await Promise.all([
      saveSchedules(nickname, schedules),
      saveTags(nickname, tags, tagItems)
    ]);
    console.log('사용자 데이터 전체 저장 완료:', nickname);
  } catch (error) {
    console.error('사용자 데이터 저장 실패:', error);
  }
};

export const initializeUserData = async (nickname) => {
  if (!nickname) return;
  
  try {
    const userData = await loadUserData(nickname);
    
    if (!userData || (userData.schedules.length === 0 && userData.tags.length === 0)) {
      await saveUserData(nickname, {
        schedules: [],
        tags: [],
        tagItems: []
      });
      console.log('신규 사용자 초기 데이터 생성 완료:', nickname);
    }
  } catch (error) {
    console.error('사용자 초기 데이터 생성 실패:', error);
  }
};