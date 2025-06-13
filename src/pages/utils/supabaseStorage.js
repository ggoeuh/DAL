// utils/supabaseStorage.js - 새로운 DAL 스키마에 맞춘 버전

import { createClient } from '@supabase/supabase-js'

// 환경변수 처리
let supabaseUrl = '';
let supabaseKey = '';

if (typeof import.meta !== 'undefined' && import.meta.env) {
  supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
} else if (typeof process !== 'undefined' && process.env) {
  supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
  supabaseKey = process.env.REACT_APP_SUPABASE_ANON_KEY;
}

let supabaseClient = null;

try {
  if (supabaseUrl && supabaseKey) {
    supabaseClient = createClient(supabaseUrl, supabaseKey);
    console.log('🌐 Supabase 초기화 성공');
  } else {
    console.warn('⚠️ Supabase 환경변수가 설정되지 않았습니다');
  }
} catch (error) {
  console.error('❌ Supabase 초기화 실패:', error);
}

export const supabase = supabaseClient;

// ✨ 새로운 DAL 스키마에 맞춘 saveUserDataToDAL
export const saveUserDataToDAL = async (nickname, userData) => {
  if (!supabase) {
    console.warn('⚠️ Supabase가 초기화되지 않았습니다');
    return { success: false, error: 'Supabase 초기화 실패' };
  }

  try {
    console.log('🎯 사용자 데이터를 DAL에 저장 시작:', nickname);
    
    const activities = [];
    
    // 일정 데이터 변환 - 새로운 스키마에 맞춤
    if (userData.schedules && userData.schedules.length > 0) {
      userData.schedules.forEach(schedule => {
        activities.push({
          user_name: nickname,
          tag: schedule.tag || 'Unknown',
          tag_type: schedule.tagType || schedule.tag || 'Unknown',
          title: schedule.title || 'No Title',
          description: schedule.description || '',
          start_time: schedule.start || '00:00',
          end_time: schedule.end || '00:00',
          date: schedule.date || new Date().toISOString().split('T')[0]
        });
      });
    }
    
    // 월간 목표 데이터 변환 - 새로운 스키마에 맞춤
    if (userData.monthlyGoals && userData.monthlyGoals.length > 0) {
      userData.monthlyGoals.forEach(monthGoal => {
        if (monthGoal.goals && monthGoal.goals.length > 0) {
          monthGoal.goals.forEach(goal => {
            activities.push({
              user_name: nickname,
              tag: 'MONTHLY_GOAL',
              tag_type: goal.tagType || 'Unknown',
              title: `${monthGoal.month} 월간목표`,
              description: `목표 시간: ${goal.targetHours}`,
              start_time: '00:00',
              end_time: goal.targetHours || '00:00',
              date: `${monthGoal.month}-01` // 월의 첫 번째 날로 설정
            });
          });
        }
      });
    }
    
    if (activities.length > 0) {
      // 기존 데이터 삭제 (안전한 방식)
      const { error: deleteError } = await supabase
        .from('DAL')
        .delete()
        .eq('user_name', nickname);
      
      if (deleteError) {
        console.warn('기존 데이터 삭제 중 오류:', deleteError);
        // 삭제 오류가 있어도 계속 진행
      }
      
      // 새 데이터 저장
      const { data, error } = await supabase
        .from('DAL')
        .insert(activities)
        .select();

      if (error) {
        throw error;
      }
      
      console.log('✅ 사용자 데이터 DAL 저장 성공:', activities.length, '개 활동');
      return { success: true, data };
    } else {
      console.log('ℹ️ 저장할 데이터가 없습니다');
      return { success: true, data: [] };
    }
    
  } catch (error) {
    console.error('❌ 사용자 데이터 DAL 저장 실패:', error);
    return { success: false, error: error.message };
  }
};

// ✨ 새로운 DAL 스키마에 맞춘 loadUserDataFromDAL
export const loadUserDataFromDAL = async (nickname) => {
  if (!supabase) {
    console.warn('⚠️ Supabase가 초기화되지 않았습니다');
    return { success: false, data: null, error: 'Supabase 초기화 실패' };
  }

  try {
    console.log('🎯 사용자 데이터를 DAL에서 불러오기 시작:', nickname);
    
    // 새로운 스키마에 맞춘 SELECT 쿼리
    const { data, error } = await supabase
      .from('DAL')
      .select('*')
      .eq('user_name', nickname)
      .order('created_at', { ascending: false });

    if (error) {
      throw error;
    }
    
    console.log(`✅ 사용자 데이터 DAL 불러오기 성공: ${data?.length || 0}개 활동`);
    
    // DAL 데이터를 캘린더 형식으로 변환
    const schedules = [];
    const monthlyGoals = [];
    
    if (data && data.length > 0) {
      data.forEach(activity => {
        if (activity.tag === 'MONTHLY_GOAL') {
          // 월간 목표 파싱
          try {
            const dateStr = activity.date;
            const month = dateStr ? dateStr.substring(0, 7) : new Date().toISOString().slice(0, 7); // YYYY-MM 형식
            
            let monthGoal = monthlyGoals.find(mg => mg.month === month);
            if (!monthGoal) {
              monthGoal = { month, goals: [] };
              monthlyGoals.push(monthGoal);
            }
            
            monthGoal.goals.push({
              tagType: activity.tag_type || 'Unknown',
              targetHours: activity.end_time || '00:00'
            });
          } catch (parseError) {
            console.warn('월간 목표 파싱 실패:', parseError);
          }
        } else {
          // 일반 일정 파싱
          try {
            schedules.push({
              id: activity.id,
              title: activity.title || 'No Title',
              description: activity.description || '',
              tag: activity.tag || 'Unknown',
              tagType: activity.tag_type || activity.tag || 'Unknown',
              date: activity.date || new Date().toISOString().split('T')[0],
              start: activity.start_time || '00:00',
              end: activity.end_time || '00:00'
            });
          } catch (parseError) {
            console.warn('일정 파싱 실패:', parseError);
          }
        }
      });
    }
    
    return { 
      success: true, 
      data: {
        schedules,
        tags: [],
        tagItems: [],
        monthlyPlans: [],
        monthlyGoals
      }
    };
    
  } catch (error) {
    console.error('❌ 사용자 데이터 DAL 불러오기 실패:', error);
    return { success: false, data: null, error: error.message };
  }
};

// ✨ 새로운 스키마에 맞춘 개발자 도구
if (typeof window !== 'undefined') {
  window.supabaseUtils = {
    // 연결 테스트
    testConnection: async () => {
      if (!supabase) {
        console.error('❌ Supabase 초기화 실패');
        alert('❌ Supabase가 초기화되지 않았습니다. 환경변수를 확인하세요.');
        return false;
      }

      try {
        console.log('🔍 Supabase 연결 테스트 시작...');
        
        const { data, error } = await supabase
          .from('DAL')
          .select('id')
          .limit(1);
        
        if (error) {
          throw error;
        }
        
        console.log('✅ Supabase 연결 성공:', data);
        alert('✅ Supabase 연결 성공!');
        return true;
      } catch (error) {
        console.error('❌ Supabase 연결 실패:', error);
        alert('❌ Supabase 연결 실패: ' + error.message);
        return false;
      }
    },
    
    // ✨ 새로운 스키마에 맞춘 DAL 테스트
    testDAL: async () => {
      console.log('🧪 DAL 테스트 시작 (새로운 스키마)');
      
      if (!supabase) {
        console.error('❌ Supabase 초기화 실패');
        alert('❌ Supabase가 초기화되지 않았습니다');
        return false;
      }
      
      try {
        // 1단계: 테이블 존재 확인
        const { data: tableData, error: tableError } = await supabase
          .from('DAL')
          .select('id')
          .limit(1);
        
        if (tableError) {
          console.error('❌ DAL 테이블 접근 실패:', tableError);
          alert('❌ DAL 테이블에 접근할 수 없습니다: ' + tableError.message);
          return false;
        }
        
        console.log('✅ DAL 테이블 접근 성공');
        
        // 2단계: 새로운 스키마에 맞춘 테스트 데이터 저장
        const testData = {
          user_name: '테스트유저_' + Date.now(),
          tag: '테스트',
          tag_type: '기타',
          title: 'DAL 연결 테스트',
          description: '새로운 스키마 테스트 - ' + new Date().toLocaleString(),
          start_time: '09:00',
          end_time: '10:00',
          date: new Date().toISOString().split('T')[0]
        };
        
        const { data: insertData, error: insertError } = await supabase
          .from('DAL')
          .insert([testData])
          .select();
        
        if (insertError) {
          console.error('❌ 데이터 저장 실패:', insertError);
          alert('❌ 데이터 저장 실패: ' + insertError.message);
          return false;
        }
        
        console.log('✅ 테스트 데이터 저장 성공:', insertData);
        
        // 3단계: 데이터 조회 테스트
        const { data: selectData, error: selectError } = await supabase
          .from('DAL')
          .select('*')
          .eq('user_name', testData.user_name);
        
        if (selectError) {
          console.error('❌ 데이터 조회 실패:', selectError);
          alert('❌ 데이터 조회 실패: ' + selectError.message);
          return false;
        }
        
        console.log('✅ 데이터 조회 성공:', selectData);
        
        // 4단계: 테스트 데이터 정리
        const { error: deleteError } = await supabase
          .from('DAL')
          .delete()
          .eq('user_name', testData.user_name);
        
        if (deleteError) {
          console.warn('⚠️ 테스트 데이터 삭제 실패 (문제없음):', deleteError);
        } else {
          console.log('✅ 테스트 데이터 정리 완료');
        }
        
        alert('✅ 새로운 스키마 DAL 테스트 완료!\n\n- 테이블 접근: 성공\n- 데이터 저장: 성공\n- 데이터 조회: 성공\n- 데이터 삭제: 성공');
        return true;
        
      } catch (error) {
        console.error('❌ DAL 테스트 실패:', error);
        alert('❌ DAL 테스트 실패: ' + error.message);
        return false;
      }
    },
    
    // 환경변수 확인
    checkEnv: () => {
      console.log('🔍 환경변수 확인:');
      console.log('SUPABASE_URL:', supabaseUrl || '❌ 없음');
      console.log('SUPABASE_ANON_KEY:', supabaseKey ? '✅ 설정됨' : '❌ 없음');
      console.log('Supabase 객체:', supabase ? '✅ 초기화됨' : '❌ 초기화 실패');
      
      const result = {
        hasUrl: !!supabaseUrl,
        hasKey: !!supabaseKey,
        hasClient: !!supabase,
        status: (supabaseUrl && supabaseKey && supabase) ? '✅ 정상' : '❌ 문제있음'
      };
      
      console.table(result);
      return result;
    },
    
    // ✨ 새로운 스키마에 맞춘 사용자 데이터 동기화 테스트
    testUserDataSync: async (nickname = '테스트유저_' + Date.now()) => {
      console.log('🧪 사용자 데이터 동기화 테스트 시작 (새로운 스키마):', nickname);
      
      const testUserData = {
        schedules: [
          {
            id: Date.now(),
            title: 'DAL 테스트 일정',
            description: 'Supabase 연동 테스트 (새로운 스키마)',
            tag: '테스트',
            tagType: '기타',
            date: new Date().toISOString().split('T')[0],
            start: '09:00',
            end: '10:00'
          },
          {
            id: Date.now() + 1,
            title: '점심 시간',
            description: '맛있는 점심 먹기',
            tag: '식사',
            tagType: '일상',
            date: new Date().toISOString().split('T')[0],
            start: '12:00',
            end: '13:00'
          }
        ],
        monthlyGoals: [
          {
            month: new Date().toISOString().slice(0, 7),
            goals: [
              { tagType: '공부', targetHours: '02:00' },
              { tagType: '운동', targetHours: '01:30' },
              { tagType: '독서', targetHours: '01:00' }
            ]
          }
        ]
      };
      
      try {
        // 저장 테스트
        const saveResult = await saveUserDataToDAL(nickname, testUserData);
        console.log('저장 결과:', saveResult);
        
        if (!saveResult.success) {
          throw new Error('저장 실패: ' + saveResult.error);
        }
        
        // 잠깐 대기 (데이터 저장 완료 보장)
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // 불러오기 테스트
        const loadResult = await loadUserDataFromDAL(nickname);
        console.log('불러오기 결과:', loadResult);
        
        if (!loadResult.success) {
          throw new Error('불러오기 실패: ' + loadResult.error);
        }
        
        // 결과 검증
        const savedSchedules = loadResult.data?.schedules?.length || 0;
        const savedGoals = loadResult.data?.monthlyGoals?.length || 0;
        const totalGoalItems = loadResult.data?.monthlyGoals?.reduce((sum, mg) => sum + (mg.goals?.length || 0), 0) || 0;
        
        // 정리
        await supabase
          .from('DAL')
          .delete()
          .eq('user_name', nickname);
        
        alert(`✅ 새로운 스키마 사용자 데이터 동기화 테스트 성공!\n\n저장된 활동: ${saveResult.data?.length || 0}개\n불러온 일정: ${savedSchedules}개\n불러온 월간목표: ${savedGoals}개 (총 ${totalGoalItems}개 항목)`);
        
        return { saveResult, loadResult };
        
      } catch (error) {
        console.error('❌ 사용자 데이터 동기화 테스트 실패:', error);
        alert('❌ 테스트 실패: ' + error.message);
        return { success: false, error: error.message };
      }
    },
    
    // ✨ 스키마 확인 도구
    checkSchema: async () => {
      if (!supabase) {
        console.error('❌ Supabase 초기화 실패');
        return false;
      }
      
      try {
        console.log('🔍 DAL 테이블 스키마 확인...');
        
        // 테이블의 모든 컬럼 정보 조회
        const { data, error } = await supabase
          .from('DAL')
          .select('*')
          .limit(1);
        
        if (error) {
          throw error;
        }
        
        console.log('✅ 예상 스키마 구조:');
        console.log('- id: BIGSERIAL PRIMARY KEY');
        console.log('- user_name: TEXT NOT NULL');
        console.log('- tag: TEXT');
        console.log('- tag_type: TEXT');
        console.log('- title: TEXT');
        console.log('- description: TEXT');
        console.log('- start_time: TEXT');
        console.log('- end_time: TEXT');
        console.log('- date: DATE');
        console.log('- created_at: TIMESTAMPTZ DEFAULT NOW()');
        
        if (data && data.length > 0) {
          console.log('✅ 실제 데이터 샘플:', data[0]);
          console.log('✅ 사용 가능한 컬럼:', Object.keys(data[0]));
        } else {
          console.log('ℹ️ 테이블에 데이터가 없습니다 (정상)');
        }
        
        alert('✅ 스키마 확인 완료! 콘솔을 확인하세요.');
        return true;
        
      } catch (error) {
        console.error('❌ 스키마 확인 실패:', error);
        alert('❌ 스키마 확인 실패: ' + error.message);
        return false;
      }
    }
  };
  
  if (supabase) {
    console.log('🚀 새로운 스키마에 맞춘 Supabase 유틸리티가 준비되었습니다!');
    console.log('사용법:');
    console.log('  supabaseUtils.checkEnv() - 환경변수 확인');
    console.log('  supabaseUtils.testConnection() - 연결 테스트');
    console.log('  supabaseUtils.checkSchema() - 스키마 확인');
    console.log('  supabaseUtils.testDAL() - DAL 테이블 테스트');
    console.log('  supabaseUtils.testUserDataSync() - 사용자 데이터 동기화 테스트');
  } else {
    console.warn('⚠️ Supabase 초기화 실패 - 환경변수를 확인하세요');
  }
}
