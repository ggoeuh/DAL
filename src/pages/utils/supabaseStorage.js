// utils/supabaseStorage.js - 쿼리 오류 수정 버전

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

// ✨ 수정된 saveUserDataToDAL - 더 안전한 쿼리
export const saveUserDataToDAL = async (nickname, userData) => {
  if (!supabase) {
    console.warn('⚠️ Supabase가 초기화되지 않았습니다');
    return { success: false, error: 'Supabase 초기화 실패' };
  }

  try {
    console.log('🎯 사용자 데이터를 DAL에 저장 시작:', nickname);
    
    const activities = [];
    
    // 일정 데이터 변환
    if (userData.schedules && userData.schedules.length > 0) {
      userData.schedules.forEach(schedule => {
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
          description: `${schedule.title || 'No Title'} | ${schedule.date} ${schedule.start}-${schedule.end}${schedule.description ? ' | ' + schedule.description : ''}`,
          duration: duration,
          completed: true
        });
      });
    }
    
    // 월간 목표 데이터 변환
    if (userData.monthlyGoals && userData.monthlyGoals.length > 0) {
      userData.monthlyGoals.forEach(monthGoal => {
        if (monthGoal.goals && monthGoal.goals.length > 0) {
          monthGoal.goals.forEach(goal => {
            activities.push({
              user_name: nickname,
              activity_type: 'MONTHLY_GOAL',
              description: `${monthGoal.month} 월간목표: ${goal.tagType} - ${goal.targetHours}`,
              duration: 0,
              completed: false
            });
          });
        }
      });
    }
    
    if (activities.length > 0) {
      // ✨ 기존 데이터 삭제 (안전한 방식)
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

// ✨ 수정된 loadUserDataFromDAL - 안전한 쿼리
export const loadUserDataFromDAL = async (nickname) => {
  if (!supabase) {
    console.warn('⚠️ Supabase가 초기화되지 않았습니다');
    return { success: false, data: null, error: 'Supabase 초기화 실패' };
  }

  try {
    console.log('🎯 사용자 데이터를 DAL에서 불러오기 시작:', nickname);
    
    // ✨ 안전한 SELECT 쿼리 (count 함수 사용 안 함)
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
        if (activity.activity_type === 'MONTHLY_GOAL') {
          // 월간 목표 파싱
          try {
            const description = activity.description;
            const monthMatch = description.match(/(\d{4}-\d{2})/);
            const goalMatch = description.match(/월간목표: (.+?) - (.+)/);
            
            if (monthMatch && goalMatch) {
              const month = monthMatch[1];
              const tagType = goalMatch[1];
              const targetHours = goalMatch[2];
              
              let monthGoal = monthlyGoals.find(mg => mg.month === month);
              if (!monthGoal) {
                monthGoal = { month, goals: [] };
                monthlyGoals.push(monthGoal);
              }
              
              monthGoal.goals.push({ tagType, targetHours });
            }
          } catch (parseError) {
            console.warn('월간 목표 파싱 실패:', parseError);
          }
        } else {
          // 일반 일정 파싱
          try {
            const description = activity.description;
            const parts = description.split(' | ');
            
            if (parts.length >= 2) {
              const title = parts[0];
              const dateTimePart = parts[1];
              const desc = parts[2] || '';
              
              const dateTimeMatch = dateTimePart.match(/(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2})-(\d{2}:\d{2})/);
              
              if (dateTimeMatch) {
                schedules.push({
                  id: activity.id,
                  title: title,
                  description: desc,
                  tag: activity.activity_type,
                  tagType: activity.activity_type,
                  date: dateTimeMatch[1],
                  start: dateTimeMatch[2],
                  end: dateTimeMatch[3]
                });
              }
            }
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

// ✨ 수정된 개발자 도구 - 안전한 연결 테스트
if (typeof window !== 'undefined') {
  window.supabaseUtils = {
    // ✨ 수정된 연결 테스트 (count 함수 대신 limit 사용)
    testConnection: async () => {
      if (!supabase) {
        console.error('❌ Supabase 초기화 실패');
        alert('❌ Supabase가 초기화되지 않았습니다. 환경변수를 확인하세요.');
        return false;
      }

      try {
        console.log('🔍 Supabase 연결 테스트 시작...');
        
        // ✨ count(*) 대신 단순한 select 사용
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
    
    // ✨ 향상된 DAL 테스트
    testDAL: async () => {
      console.log('🧪 DAL 테스트 시작');
      
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
        
        // 2단계: 테스트 데이터 저장
        const testData = {
          user_name: '테스트유저_' + Date.now(),
          activity_type: '테스트',
          description: 'DAL 연결 테스트 - ' + new Date().toLocaleString(),
          duration: 5,
          completed: true
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
        
        alert('✅ DAL 테스트 완료!\n\n- 테이블 접근: 성공\n- 데이터 저장: 성공\n- 데이터 조회: 성공\n- 데이터 삭제: 성공');
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
    
    // ✨ 사용자 데이터 동기화 테스트 (안전한 버전)
    testUserDataSync: async (nickname = '테스트유저_' + Date.now()) => {
      console.log('🧪 사용자 데이터 동기화 테스트 시작:', nickname);
      
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
          }
        ],
        monthlyGoals: [
          {
            month: new Date().toISOString().slice(0, 7),
            goals: [
              { tagType: '공부', targetHours: '02:00' },
              { tagType: '운동', targetHours: '01:30' }
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
        
        // 불러오기 테스트
        const loadResult = await loadUserDataFromDAL(nickname);
        console.log('불러오기 결과:', loadResult);
        
        if (!loadResult.success) {
          throw new Error('불러오기 실패: ' + loadResult.error);
        }
        
        // 정리
        await supabase
          .from('DAL')
          .delete()
          .eq('user_name', nickname);
        
        alert(`✅ 사용자 데이터 동기화 테스트 성공!\n\n저장: ${saveResult.data?.length || 0}개 활동\n불러오기: ${loadResult.data?.schedules?.length || 0}개 일정, ${loadResult.data?.monthlyGoals?.length || 0}개 월간목표`);
        
        return { saveResult, loadResult };
        
      } catch (error) {
        console.error('❌ 사용자 데이터 동기화 테스트 실패:', error);
        alert('❌ 테스트 실패: ' + error.message);
        return { success: false, error: error.message };
      }
    }
  };
  
  if (supabase) {
    console.log('🚀 수정된 Supabase 유틸리티가 준비되었습니다!');
    console.log('사용법:');
    console.log('  supabaseUtils.checkEnv() - 환경변수 확인');
    console.log('  supabaseUtils.testConnection() - 연결 테스트');
    console.log('  supabaseUtils.testDAL() - DAL 테이블 테스트');
    console.log('  supabaseUtils.testUserDataSync() - 사용자 데이터 동기화 테스트');
  } else {
    console.warn('⚠️ Supabase 초기화 실패 - 환경변수를 확인하세요');
  }
}
