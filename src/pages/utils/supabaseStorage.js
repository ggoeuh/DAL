// utils/supabaseStorage.js - Supabase 기반 스토리지 시스템

import { createClient } from '@supabase/supabase-js'

// Supabase 설정
const supabaseUrl = 'YOUR_SUPABASE_URL'
const supabaseKey = 'YOUR_SUPABASE_ANON_KEY'

export const supabase = createClient(supabaseUrl, supabaseKey)

// =========================
// 🌐 Supabase 데이터 함수들
// =========================

// 서버에서 사용자 데이터 불러오기
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

// Supabase에 사용자 데이터 저장
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

// 실시간 데이터 변경 감지
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
// 🔧 마이그레이션 도구들
// =========================

// 기존 로컬 데이터를 Supabase로 마이그레이션
export const migrateLocalToSupabase = async (nickname) => {
  if (!nickname) {
    console.error('❌ 마이그레이션 실패: 사용자명이 없습니다');
    return false;
  }

  try {
    console.log('🚀 로컬 → Supabase 마이그레이션 시작:', nickname);
    
    // 기존 로컬 데이터 수집
    const localData = {
      schedules: loadSchedulesFromStorage(nickname),
      tags: loadTagsFromStorage(nickname),
      tagItems: loadTagItemsFromStorage(nickname),
      monthlyPlans: loadMonthlyPlansFromStorage(nickname),
      monthlyGoals: loadMonthlyGoalsFromStorage(nickname)
    };
    
    console.log('📦 로컬 데이터 수집 완료:', localData);
    
    // Supabase에 저장
    const success = await saveToSupabase(nickname, localData);
    
    if (success) {
      console.log('✅ 마이그레이션 성공:', nickname);
      
      // 마이그레이션 성공 시 로컬 데이터 백업
      const backupKey = `${nickname}_migration_backup_${Date.now()}`;
      localStorage.setItem(backupKey, JSON.stringify(localData));
      
      return true;
    } else {
      throw new Error('Supabase 저장 실패');
    }
    
  } catch (error) {
    console.error('❌ 마이그레이션 실패:', error);
    return false;
  }
};

// 기존 서버 데이터를 Supabase로 마이그레이션 (기존 API 사용)
export const migrateServerToSupabase = async (nickname) => {
  if (!nickname) return false;

  try {
    console.log('🚀 서버 → Supabase 마이그레이션 시작:', nickname);
    
    // 기존 서버에서 데이터 로드
    const serverData = await loadFromServer(nickname); // 기존 함수 사용
    
    if (!serverData) {
      console.log('📭 서버에 데이터가 없습니다:', nickname);
      return false;
    }
    
    // Supabase에 저장
    const success = await saveToSupabase(nickname, serverData);
    
    if (success) {
      console.log('✅ 서버 → Supabase 마이그레이션 성공:', nickname);
      return true;
    } else {
      throw new Error('Supabase 저장 실패');
    }
    
  } catch (error) {
    console.error('❌ 서버 → Supabase 마이그레이션 실패:', error);
    return false;
  }
};

// =========================
// 🔗 기존 코드와의 호환성
// =========================

// 기존 함수들을 Supabase 버전으로 래핑
export const loadFromServer = loadFromSupabase;
export const saveToServer = saveToSupabase;

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
    // 마이그레이션
    migrateToSupabase: async (nickname) => {
      if (!nickname) {
        console.log('사용법: supabaseUtils.migrateToSupabase("사용자명")');
        return;
      }
      
      const localSuccess = await migrateLocalToSupabase(nickname);
      const serverSuccess = await migrateServerToSupabase(nickname);
      
      if (localSuccess || serverSuccess) {
        alert('✅ Supabase 마이그레이션 완료!');
        window.location.reload();
      } else {
        alert('❌ 마이그레이션 실패!');
      }
    },
    
    // 실시간 테스트
    testRealtime: (nickname) => {
      if (!nickname) {
        console.log('사용법: supabaseUtils.testRealtime("사용자명")');
        return;
      }
      
      const subscription = subscribeToUserData(nickname, (payload) => {
        console.log('🔄 실시간 데이터 변경:', payload);
        alert('실시간 데이터 변경 감지!');
      });
      
      setTimeout(() => {
        unsubscribeFromUserData(subscription);
        console.log('🔄 실시간 테스트 종료');
      }, 30000);
      
      console.log('🔄 30초간 실시간 테스트 중...');
    },
    
    // Supabase 연결 테스트
    testConnection: async () => {
      try {
        const { data, error } = await supabase
          .from('user_data')
          .select('count(*)')
          .limit(1);
        
        if (error) throw error;
        
        console.log('✅ Supabase 연결 성공');
        alert('✅ Supabase 연결 성공!');
        return true;
      } catch (error) {
        console.error('❌ Supabase 연결 실패:', error);
        alert('❌ Supabase 연결 실패!');
        return false;
      }
    }
  };
  
  console.log('🚀 Supabase 유틸리티가 준비되었습니다!');
  console.log('사용법:');
  console.log('  supabaseUtils.migrateToSupabase("사용자명") - 마이그레이션');
  console.log('  supabaseUtils.testConnection() - 연결 테스트');
  console.log('  supabaseUtils.testRealtime("사용자명") - 실시간 테스트');
}
