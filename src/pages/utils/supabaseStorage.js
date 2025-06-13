// utils/supabaseStorage.js - 문법 오류 수정된 버전

import { createClient } from '@supabase/supabase-js'

// Vite 환경변수에서 값 가져오기
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// Supabase 클라이언트 생성 (환경변수가 없어도 빌드는 성공하도록)
let supabaseClient = null;

try {
  if (supabaseUrl && supabaseKey) {
    supabaseClient = createClient(supabaseUrl, supabaseKey);
    console.log('🌐 Supabase 초기화 성공');
  } else {
    console.warn('⚠️ Supabase 환경변수가 설정되지 않았습니다');
    console.log('필요한 환경변수: VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY');
  }
} catch (error) {
  console.error('❌ Supabase 초기화 실패:', error);
}

// export는 최상위 레벨에서만 사용
export const supabase = supabaseClient;

// =========================
// 🌐 Supabase 데이터 함수들
// =========================

// DAL 테이블에 활동 저장
export const saveActivityToDAL = async (activityData) => {
  if (!supabase) {
    console.error('❌ Supabase가 초기화되지 않았습니다');
    return { success: false, error: 'Supabase 초기화 실패' };
  }

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
  if (!supabase) {
    console.error('❌ Supabase가 초기화되지 않았습니다');
    return { success: false, data: [], error: 'Supabase 초기화 실패' };
  }

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
  if (!supabase) {
    console.error('❌ Supabase가 초기화되지 않았습니다');
    return { success: false, error: 'Supabase 초기화 실패' };
  }

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

// =========================
// 🔄 실시간 데이터 동기화
// =========================

// DAL 테이블 실시간 구독
export const subscribeToDAL = (callback) => {
  if (!supabase) {
    console.error('❌ Supabase가 초기화되지 않았습니다');
    return null;
  }

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

// 실시간 구독 해제
export const unsubscribeFromUserData = (subscription) => {
  if (subscription) {
    subscription.unsubscribe();
    console.log('🔄 실시간 구독 해제');
  }
};

// =========================
// 🛠️ 개발자 도구들
// =========================

// 브라우저 환경에서만 실행
if (typeof window !== 'undefined') {
  window.supabaseUtils = {
    // Supabase 연결 테스트
    testConnection: async () => {
      if (!supabase) {
        console.error('❌ Supabase 초기화 실패');
        alert('❌ Supabase가 초기화되지 않았습니다. 환경변수를 확인하세요.');
        return false;
      }

      try {
        const { data, error } = await supabase
          .from('DAL')
          .select('count(*)')
          .limit(1);
        
        if (error) throw error;
        
        console.log('✅ Supabase 연결 성공');
        alert('✅ Supabase 연결 성공!');
        return true;
      } catch (error) {
        console.error('❌ Supabase 연결 실패:', error);
        alert('❌ Supabase 연결 실패: ' + error.message);
        return false;
      }
    },
    
    // 환경변수 확인
    checkEnv: () => {
      console.log('🔍 환경변수 확인:');
      console.log('VITE_SUPABASE_URL:', supabaseUrl || '❌ 없음');
      console.log('VITE_SUPABASE_ANON_KEY:', supabaseKey ? '✅ 설정됨' : '❌ 없음');
      console.log('Supabase 객체:', supabase ? '✅ 초기화됨' : '❌ 초기화 실패');
      
      if (!supabaseUrl || !supabaseKey) {
        console.error('❌ 환경변수가 설정되지 않았습니다');
        console.log('Netlify 환경변수를 확인하세요');
      }
    },
    
    // DAL 테스트
    testDAL: async () => {
      if (!supabase) {
        console.error('❌ Supabase 초기화 실패');
        alert('❌ Supabase가 초기화되지 않았습니다');
        return false;
      }

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
    
    // 실시간 테스트
    testRealtime: () => {
      if (!supabase) {
        console.error('❌ Supabase 초기화 실패');
        return null;
      }

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
    }
  };
  
  // 초기화 상태에 따른 메시지
  if (supabase) {
    console.log('🚀 Supabase 유틸리티가 준비되었습니다!');
    console.log('사용법:');
    console.log('  supabaseUtils.checkEnv() - 환경변수 확인');
    console.log('  supabaseUtils.testConnection() - 연결 테스트');
    console.log('  supabaseUtils.testDAL() - DAL 테이블 테스트');
    console.log('  supabaseUtils.testRealtime() - 실시간 테스트');
  } else {
    console.warn('⚠️ Supabase 초기화 실패 - 환경변수를 확인하세요');
    console.log('브라우저에서 supabaseUtils.checkEnv()로 환경변수 상태 확인 가능');
  }
}
