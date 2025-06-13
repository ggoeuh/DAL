// utils/supabaseStorage.js - Vite + Supabase 기반 스토리지 시스템

import { createClient } from '@supabase/supabase-js'

// Vite 환경변수에서 Supabase 설정 가져오기
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// 개발 중 fallback 값 (환경변수가 없을 때 사용)
const fallbackUrl = 'https://hbrnjzclvtreppxzsspv.supabase.co'
const fallbackKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhicm5qemNsdnRyZXBweHpzc3B2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDk3NjY5OTgsImV4cCI6MjA2NTM0Mjk5OH0.txgsa7O_kzdeI2RjM1CEiIW6Zt419gr0o2BgULdTcQc'

// Supabase 클라이언트 생성
export const supabase = createClient(
  supabaseUrl || fallbackUrl,
  supabaseKey || fallbackKey
)

// 연결 상태 확인 로그
console.log('🌐 Vite + Supabase 초기화:', {
  url: supabaseUrl ? '✅ 환경변수 사용' : '⚠️ fallback 사용',
  key: supabaseKey ? '✅ 환경변수 사용' : '⚠️ fallback 사용',
  actualUrl: supabaseUrl || fallbackUrl
})

// =========================
// 🌐 Supabase 데이터 함수들
// =========================

// DAL 테이블에 활동 저장
export const saveActivityToDAL = async (activityData) => {
  try {
    console.log('🎯 DAL에 활동 저장 시작:', activityData);
    
    const { data, error } = await supabase
      .from('DAL')
      .insert([activityData])
      .select();

    if (error) {
      throw error;
    }
    
    console.log('✅ DAL 활동 저장 성공:', data);
    return { success: true, data };
    
  } catch (error) {
    console.error('❌ DAL 활동 저장 실패:', error);
    return { success: false, error: error.message };
  }
};

// DAL 테이블에서 활동 목록 불러오기
export const loadActivitiesFromDAL = async (userId = null) => {
  try {
    console.log('🎯 DAL에서 활동 불러오기 시작:', userId);
    
    let query = supabase
      .from('DAL')
      .select('*')
      .order('created_at', { ascending: false });
    
    // 특정 사용자 필터링
    if (userId) {
      query = query.eq('user_name', userId);
    }
    
    const { data, error } = await query;

    if (error) {
      throw error;
    }
    
    console.log('✅ DAL 활동 불러오기 성공:', data?.length || 0, '개');
    return { success: true, data: data || [] };
    
  } catch (error) {
    console.error('❌ DAL 활동 불러오기 실패:', error);
    return { success: false, data: [], error: error.message };
  }
};

// DAL 테이블에서 활동 삭제
export const deleteActivityFromDAL = async (activityId) => {
  try {
    console.log('🎯 DAL에서 활동 삭제 시작:', activityId);
    
    const { error } = await supabase
      .from('DAL')
      .delete()
      .eq('id', activityId);

    if (error) {
      throw error;
    }
    
    console.log('✅ DAL 활동 삭제 성공');
    return { success: true };
    
  } catch (error) {
    console.error('❌ DAL 활동 삭제 실패:', error);
    return { success: false, error: error.message };
  }
};

// 서버에서 사용자 데이터 불러오기 (기존 시스템용)
export const loadFromSupabase = async (nickname) => {
  if (!nickname) {
    console.error('❌ Supabase 불러오기 실패: 사용자명이 없습니다');
    return null;
  }

  try {
    console.log('🌐 Supabase에서 데이터 불러오기 시작:', nickname);
    
    const { data, error } = await supabase
      .from('user_data')
      .select('*')
      .eq('user_id', nickname)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        // 데이터가 없는 경우 (첫 사용자)
        console.log('📭 Supabase에 사용자 데이터가 없습니다:', nickname);
        return null;
      }
      throw error;
    }
    
    console.log('✅ Supabase에서 데이터 불러오기 성공:', nickname);
    
    // 데이터 구조 검증 및 기본값 보장
    const validatedData = {
      schedules: Array.isArray(data?.schedules) ? data.schedules : [],
      tags: Array.isArray(data?.tags) ? data.tags : [],
      tagItems: Array.isArray(data?.tag_items) ? data.tag_items : [],
      monthlyPlans: Array.isArray(data?.monthly_plans) ? data.monthly_plans : [],
      monthlyGoals: Array.isArray(data?.monthly_goals) ? data.monthly_goals : [],
      lastUpdated: data?.updated_at || new Date().toISOString()
    };
    
    return validatedData;
    
  } catch (error) {
    console.error('❌ Supabase에서 데이터 불러오기 실패:', error);
    return null;
  }
};

// Supabase에 사용자 데이터 저장 (기존 시스템용)
export const saveToSupabase = async (nickname, data) => {
  if (!nickname) {
    console.error('❌ Supabase 저장 실패: 사용자명이 없습니다');
    return false;
  }

  try {
    console.log('🌐 Supabase에 데이터 저장 시작:', nickname);
    
    const dataToSave = {
      user_id: nickname,
      schedules: data?.schedules || [],
      tags: data?.tags || [],
      tag_items: data?.tagItems || [],
      monthly_plans: data?.monthlyPlans || [],
      monthly_goals: data?.monthlyGoals || []
    };
    
    // UPSERT 사용 (있으면 업데이트, 없으면 삽입)
    const { data: result, error } = await supabase
      .from('user_data')
      .upsert(dataToSave, {
        onConflict: 'user_id'
      })
      .select();

    if (error) {
      throw error;
    }
    
    console.log('✅ Supabase에 데이터 저장 성공:', nickname);
    return true;
    
  } catch (error) {
    console.error('❌ Supabase에 데이터 저장 실패:', error);
    return false;
  }
};

// =========================
// 🔄 실시간 데이터 동기화
// =========================

// DAL 테이블 실시간 구독
export const subscribeToDAL = (callback) => {
  console.log('🔄 DAL 실시간 구독 시작');

  const subscription = supabase
    .channel('dal_changes')
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'DAL'
      },
      (payload) => {
        console.log('🔄 DAL 실시간 변경 감지:', payload);
        if (callback) {
          callback(payload);
        }
      }
    )
    .subscribe();

  return subscription;
};

// 실시간 데이터 변경 감지 (기존 시스템용)
export const subscribeToUserData = (nickname, callback) => {
  if (!nickname) return null;

  console.log('🔄 실시간 구독 시작:', nickname);

  const subscription = supabase
    .channel(`user_data_${nickname}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'user_data',
        filter: `user_id=eq.${nickname}`
      },
      (payload) => {
        console.log('🔄 실시간 데이터 변경 감지:', payload);
        if (callback) {
          callback(payload);
        }
      }
    )
    .subscribe();

  return subscription;
};

// 실시간 구독 해제
export const unsubscribeFromUserData = (subscription) => {
  if (subscription) {
    subscription.unsubscribe();
    console.log('🔄 실시간 구독 해제');
  }
};

// =========================
// 🔗 기존 코드와의 호환성
// =========================

// 기존 함수들을 Supabase 버전으로 래핑
export const loadFromServer = loadFromSupabase;
export const saveToServer = saveToSupabase;

// 기존 로컬 스토리지 함수들을 import (unifiedStorage.js에서)
// 이 함수들은 기존 unifiedStorage.js에서 가져와야 합니다
const loadSchedulesFromStorage = (nickname) => {
  try {
    const data = localStorage.getItem(`${nickname}-schedules`);
    return data ? JSON.parse(data) : [];
  } catch (error) {
    console.error('로컬 스케줄 로드 실패:', error);
    return [];
  }
};

const loadTagsFromStorage = (nickname) => {
  try {
    const data = localStorage.getItem(`${nickname}-tags`);
    return data ? JSON.parse(data) : [];
  } catch (error) {
    console.error('로컬 태그 로드 실패:', error);
    return [];
  }
};

const loadTagItemsFromStorage = (nickname) => {
  try {
    const data = localStorage.getItem(`${nickname}-tagItems`);
    return data ? JSON.parse(data) : [];
  } catch (error) {
    console.error('로컬 태그 아이템 로드 실패:', error);
    return [];
  }
};

const loadMonthlyPlansFromStorage = (nickname) => {
  try {
    const data = localStorage.getItem(`${nickname}-monthlyPlans`);
    return data ? JSON.parse(data) : [];
  } catch (error) {
    console.error('로컬 월간 계획 로드 실패:', error);
    return [];
  }
};

const loadMonthlyGoalsFromStorage = (nickname) => {
  try {
    const data = localStorage.getItem(`${nickname}-monthlyGoals`);
    return data ? JSON.parse(data) : [];
  } catch (error) {
    console.error('로컬 월간 목표 로드 실패:', error);
    return [];
  }
};

const saveSchedulesToStorage = (nickname, data) => {
  try {
    localStorage.setItem(`${nickname}-schedules`, JSON.stringify(data));
  } catch (error) {
    console.error('로컬 스케줄 저장 실패:', error);
  }
};

const saveTagsToStorage = (nickname, data) => {
  try {
    localStorage.setItem(`${nickname}-tags`, JSON.stringify(data));
  } catch (error) {
    console.error('로컬 태그 저장 실패:', error);
  }
};

const saveTagItemsToStorage = (nickname, data) => {
  try {
    localStorage.setItem(`${nickname}-tagItems`, JSON.stringify(data));
  } catch (error) {
    console.error('로컬 태그 아이템 저장 실패:', error);
  }
};

const saveMonthlyPlansToStorage = (nickname, data) => {
  try {
    localStorage.setItem(`${nickname}-monthlyPlans`, JSON.stringify(data));
  } catch (error) {
    console.error('로컬 월간 계획 저장 실패:', error);
  }
};

const saveMonthlyGoalsToStorage = (nickname, data) => {
  try {
    localStorage.setItem(`${nickname}-monthlyGoals`, JSON.stringify(data));
  } catch (error) {
    console.error('로컬 월간 목표 저장 실패:', error);
  }
};

const saveToLocalStorage = (nickname, data) => {
  try {
    const key = `${nickname}_backup`;
    localStorage.setItem(key, JSON.stringify(data));
    console.log('💾 로컬 백업 저장 완료');
  } catch (error) {
    console.error('❌ 로컬 백업 저장 실패:', error);
  }
};

// 통합 데이터 로딩 (Supabase 우선, 로컬 백업)
export const loadAllUserData = async (nickname) => {
  if (!nickname) return null;
  
  console.log('📦 전체 사용자 데이터 불러오기 시작:', nickname);
  
  try {
    // 1. Supabase에서 데이터 시도
    const supabaseData = await loadFromSupabase(nickname);
    
    if (supabaseData) {
      console.log('✅ Supabase 데이터 사용:', nickname);
      
      // Supabase 데이터를 로컬에도 백업
      saveToLocalStorage(nickname, supabaseData);
      
      return supabaseData;
    } else {
      console.log('⚠️ Supabase 데이터 없음, 로컬 데이터 확인:', nickname);
    }
  } catch (error) {
    console.error('❌ Supabase 데이터 로드 실패:', error);
  }
  
  // 2. Supabase 실패 시 로컬 데이터 사용
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

// 핵심 데이터 저장 (Supabase + 로컬)
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
  
  // 2. Supabase에 백그라운드 저장
  try {
    const supabaseSuccess = await saveToSupabase(nickname, dataToSave);
    if (supabaseSuccess) {
      console.log('✅ Supabase 저장 완료');
    } else {
      console.log('⚠️ Supabase 저장 실패, 로컬에만 저장됨');
    }
    return supabaseSuccess;
  } catch (error) {
    console.error('❌ Supabase 저장 실패:', error);
    return false;
  }
};

// =========================
// 🛠️ 개발자 도구들
// =========================

if (typeof window !== 'undefined') {
  window.supabaseUtils = {
    // DAL 테스트 함수들
    testDAL: async () => {
      console.log('🧪 DAL 테스트 시작');
      
      // 테스트 데이터 저장
      const testActivity = {
        user_name: '테스트유저',
        activity_type: '테스트',
        description: 'DAL 연결 테스트',
        duration: 5,
        completed: true
      };
      
      const saveResult = await saveActivityToDAL(testActivity);
      console.log('저장 결과:', saveResult);
      
      // 데이터 불러오기
      const loadResult = await loadActivitiesFromDAL();
      console.log('불러오기 결과:', loadResult);
      
      return { saveResult, loadResult };
    },
    
    // Supabase 연결 테스트
    testConnection: async () => {
      try {
        const { data, error } = await supabase
          .from('DAL')
          .select('count(*)')
          .limit(1);
        
        if (error) throw error;
        
        console.log('✅ Supabase 연결 성공');
        console.log('환경변수 상태:', {
          url: import.meta.env.VITE_SUPABASE_URL ? '✅ 설정됨' : '❌ 없음',
          key: import.meta.env.VITE_SUPABASE_ANON_KEY ? '✅ 설정됨' : '❌ 없음'
        });
        alert('✅ Supabase 연결 성공!');
        return true;
      } catch (error) {
        console.error('❌ Supabase 연결 실패:', error);
        alert('❌ Supabase 연결 실패: ' + error.message);
        return false;
      }
    },
    
    // 실시간 테스트
    testRealtime: () => {
      console.log('🔄 DAL 실시간 테스트 시작 (30초)');
      
      const subscription = subscribeToDAL((payload) => {
        console.log('🔄 실시간 변경 감지:', payload);
        alert('실시간 데이터 변경 감지!');
      });
      
      setTimeout(() => {
        unsubscribeFromUserData(subscription);
        console.log('🔄 실시간 테스트 종료');
      }, 30000);
      
      return subscription;
    },
    
    // 환경변수 확인
    checkEnv: () => {
      console.log('🔍 환경변수 확인:');
      console.log('VITE_SUPABASE_URL:', import.meta.env.VITE_SUPABASE_URL);
      console.log('VITE_SUPABASE_ANON_KEY:', import.meta.env.VITE_SUPABASE_ANON_KEY ? '설정됨' : '없음');
      console.log('현재 사용 중인 URL:', supabaseUrl || fallbackUrl);
      console.log('현재 사용 중인 키:', supabaseKey ? '환경변수' : 'fallback');
    }
  };
  
  console.log('🚀 Vite + Supabase 유틸리티가 준비되었습니다!');
  console.log('사용법:');
  console.log('  supabaseUtils.testConnection() - 연결 테스트');
  console.log('  supabaseUtils.testDAL() - DAL 테이블 테스트');
  console.log('  supabaseUtils.testRealtime() - 실시간 테스트');
  console.log('  supabaseUtils.checkEnv() - 환경변수 확인');
}
