// utils/supabaseStorage.js - 완전 수정 버전

import { createClient } from '@supabase/supabase-js'

// ✨ 환경변수 처리 개선 (Vite/React 호환)
let supabaseUrl = '';
let supabaseKey = '';

// Vite 환경인지 React 환경인지 확인
if (typeof import.meta !== 'undefined' && import.meta.env) {
  // Vite 환경
  supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
} else if (typeof process !== 'undefined' && process.env) {
  // React 환경
  supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
  supabaseKey = process.env.REACT_APP_SUPABASE_ANON_KEY;
}

console.log('🔍 환경변수 체크:', {
  isVite: typeof import.meta !== 'undefined',
  isReact: typeof process !== 'undefined',
  hasUrl: !!supabaseUrl,
  hasKey: !!supabaseKey
});

// Supabase 클라이언트 생성 (환경변수가 없어도 빌드는 성공하도록)
let supabaseClient = null;

try {
  if (supabaseUrl && supabaseKey) {
    supabaseClient = createClient(supabaseUrl, supabaseKey);
    console.log('🌐 Supabase 초기화 성공');
  } else {
    console.warn('⚠️ Supabase 환경변수가 설정되지 않았습니다');
    console.log('필요한 환경변수:');
    console.log('- Vite: VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY');
    console.log('- React: REACT_APP_SUPABASE_URL, REACT_APP_SUPABASE_ANON_KEY');
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

// ✨ 사용자별 모든 데이터를 DAL에 저장 (캘린더 앱용)
export const saveUserDataToDAL = async (nickname, userData) => {
  if (!supabase) {
    console.warn('⚠️ Supabase가 초기화되지 않았습니다 - 로컬 저장만 진행');
    return { success: false, error: 'Supabase 초기화 실패' };
  }

  try {
    console.log('🎯 사용자 데이터를 DAL에 저장 시작:', nickname);
    
    // 각 일정을 개별 활동으로 저장
    const activities = [];
    
    if (userData.schedules && userData.schedules.length > 0) {
      userData.schedules.forEach(schedule => {
        // 시간 계산
        const parseTime = (time) => {
          const [h, m] = time.split(':').map(Number);
          return h * 60 + m;
        };
        
        const startMinutes = parseTime(schedule.start);
        const endMinutes = parseTime(schedule.end);
        const duration = endMinutes - startMinutes;
        
        activities.push({
          user_name: nickname,
          activity_type: schedule.tag || 'Unknown',
          description: `${schedule.title} ${schedule.description ? '- ' + schedule.description : ''}`,
          duration: duration,
          completed: true,
          activity_date: schedule.date,
          start_time: schedule.start,
          end_time: schedule.end,
          tag_type: schedule.tagType || 'Unknown',
          metadata: JSON.stringify({
            scheduleId: schedule.id,
            originalData: schedule
          })
        });
      });
    }
    
    if (activities.length > 0) {
      const { data, error } = await supabase
        .from('DAL')
        .upsert(activities, { 
          onConflict: 'user_name,activity_date,start_time,end_time',
          ignoreDuplicates: false 
        })
        .select();

      if (error) {
        throw error;
      }
      
      console.log('✅ 사용자 데이터 DAL 저장 성공:', data?.length || 0, '개 활동');
      return { success: true, data };
    } else {
      console.log('ℹ️ 저장할 일정이 없습니다');
      return { success: true, data: [] };
    }
    
  } catch (error) {
    console.error('❌ 사용자 데이터 DAL 저장 실패:', error);
    return { success: false, error: error.message };
  }
};

// ✨ 사용자별 데이터를 DAL에서 불러오기 (캘린더 앱용)
export const loadUserDataFromDAL = async (nickname) => {
  if (!supabase) {
    console.warn('⚠️ Supabase가 초기화되지 않았습니다');
    return { success: false, data: null, error: 'Supabase 초기화 실패' };
  }

  try {
    console.log('🎯 사용자 데이터를 DAL에서 불러오기 시작:', nickname);
    
    const { data, error } = await supabase
      .from('DAL')
      .select('*')
      .eq('user_name', nickname)
      .order('activity_date', { ascending: false });

    if (error) {
      throw error;
    }
    
    // DAL 데이터를 캘린더 형식으로 변환
    const schedules = data.map(activity => ({
      id: activity.id,
      title: activity.description.split(' - ')[0] || activity.description,
      description: activity.description.split(' - ')[1] || '',
      tag: activity.activity_type,
      tagType: activity.tag_type,
      date: activity.activity_date,
      start: activity.start_time,
      end: activity.end_time
    }));
    
    console.log('✅ 사용자 데이터 DAL 불러오기 성공:', schedules.length, '개 일정');
    return { 
      success: true, 
      data: {
        schedules,
        tags: [], // 태그는 로컬에서 관리
        tagItems: [], // 태그 아이템도 로컬에서 관리
        monthlyPlans: [],
        monthlyGoals: []
      }
    };
    
  } catch (error) {
    console.error('❌ 사용자 데이터 DAL 불러오기 실패:', error);
    return { success: false, data: null, error: error.message };
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
      console.log('SUPABASE_URL:', supabaseUrl || '❌ 없음');
      console.log('SUPABASE_ANON_KEY:', supabaseKey ? '✅ 설정됨' : '❌ 없음');
      console.log('Supabase 객체:', supabase ? '✅ 초기화됨' : '❌ 초기화 실패');
      
      if (!supabaseUrl || !supabaseKey) {
        console.error('❌ 환경변수가 설정되지 않았습니다');
        console.log('필요한 환경변수:');
        console.log('- Vite: VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY');
        console.log('- React: REACT_APP_SUPABASE_URL, REACT_APP_SUPABASE_ANON_KEY');
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
    },

    // ✨ 캘린더 앱용 테스트 함수들
    testUserDataSync: async (nickname = '테스트유저') => {
      console.log('🧪 사용자 데이터 동기화 테스트 시작:', nickname);
      
      // 테스트 데이터 생성
      const testUserData = {
        schedules: [
          {
            id: Date.now(),
            title: 'DAL 테스트 일정',
            description: 'Supabase 연동 테스트',
            tag: '테스트',
            tagType: '기타',
            date: new Date().toISOString().split('T')[0],
            start: '09:00',
            end: '10:00'
          },
          {
            id: Date.now() + 1,
            title: 'DAL 테스트 일정 2',
            description: 'Supabase 연동 테스트 2',
            tag: '공부',
            tagType: '학습',
            date: new Date().toISOString().split('T')[0],
            start: '14:00',
            end: '15:30'
          }
        ]
      };
      
      // 저장 테스트
      const saveResult = await saveUserDataToDAL(nickname, testUserData);
      console.log('저장 결과:', saveResult);
      
      // 불러오기 테스트
      const loadResult = await loadUserDataFromDAL(nickname);
      console.log('불러오기 결과:', loadResult);
      
      alert(`📊 사용자 데이터 동기화 테스트 완료\n\n저장: ${saveResult.success ? '성공' : '실패'}\n불러오기: ${loadResult.success ? '성공' : '실패'}\n\n자세한 내용은 콘솔을 확인하세요.`);
      
      return { saveResult, loadResult };
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
    console.log('  supabaseUtils.testUserDataSync() - 사용자 데이터 동기화 테스트');
  } else {
    console.warn('⚠️ Supabase 초기화 실패 - 환경변수를 확인하세요');
    console.log('브라우저에서 supabaseUtils.checkEnv()로 환경변수 상태 확인 가능');
  }
}
