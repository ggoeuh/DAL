// utils/supabaseStorage.js - 태그 생성 문제 수정 버전

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

// 파스텔 색상 팔레트 (태그 자동 색상 할당용)
const PASTEL_COLORS = [
  { bg: "bg-purple-100", text: "text-purple-800" },
  { bg: "bg-blue-100", text: "text-blue-800" },
  { bg: "bg-green-100", text: "text-green-800" },
  { bg: "bg-yellow-100", text: "text-yellow-800" },
  { bg: "bg-red-100", text: "text-red-800" },
  { bg: "bg-pink-100", text: "text-pink-800" },
  { bg: "bg-indigo-100", text: "text-indigo-800" },
  { bg: "bg-cyan-100", text: "text-cyan-800" },
  { bg: "bg-teal-100", text: "text-teal-800" },
  { bg: "bg-orange-100", text: "text-orange-800" },
];

// ✨ 새로운 DAL 스키마에 맞춘 saveUserDataToDAL
export const saveUserDataToDAL = async (nickname, userData) => {
  if (!supabase) {
    console.warn('⚠️ Supabase가 초기화되지 않았습니다');
    return { success: false, error: 'Supabase 초기화 실패' };
  }

  try {
    console.log('🎯 사용자 데이터를 DAL에 저장 시작:', nickname);
    console.log('🔍 저장할 데이터:', userData);
    
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
    
    // 🔧 태그 데이터를 DAL에 저장 (새로 추가!)
    if (userData.tags && userData.tags.length > 0) {
      userData.tags.forEach(tag => {
        activities.push({
          user_name: nickname,
          tag: 'TAG_DEFINITION',
          tag_type: tag.tagType || 'Unknown',
          title: 'Tag Definition',
          description: JSON.stringify(tag.color || {}),
          start_time: '00:00',
          end_time: '00:00',
          date: new Date().toISOString().split('T')[0]
        });
      });
    }
    
    // 🔧 태그 아이템 데이터를 DAL에 저장 (새로 추가!)
    if (userData.tagItems && userData.tagItems.length > 0) {
      userData.tagItems.forEach(tagItem => {
        activities.push({
          user_name: nickname,
          tag: 'TAG_ITEM',
          tag_type: tagItem.tagType || 'Unknown',
          title: tagItem.tagName || 'Unknown',
          description: 'Tag Item Definition',
          start_time: '00:00',
          end_time: '00:00',
          date: new Date().toISOString().split('T')[0]
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

// ✨ 새로운 DAL 스키마에 맞춘 loadUserDataFromDAL (태그 복원 기능 추가)
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
    console.log('🔍 불러온 원본 데이터:', data);
    
    // DAL 데이터를 캘린더 형식으로 변환
    const schedules = [];
    const monthlyGoals = [];
    const tags = [];
    const tagItems = [];
    
    // 🔧 태그 타입별로 수집하여 자동 생성
    const uniqueTagTypes = new Set();
    const uniqueTagNames = new Map(); // tagType -> Set of tagNames
    
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
        } else if (activity.tag === 'TAG_DEFINITION') {
          // 🔧 저장된 태그 정의 복원
          try {
            const tagType = activity.tag_type || 'Unknown';
            let color;
            try {
              color = JSON.parse(activity.description || '{}');
            } catch {
              color = PASTEL_COLORS[tags.length % PASTEL_COLORS.length];
            }
            
            if (!tags.find(t => t.tagType === tagType)) {
              tags.push({ tagType, color });
            }
          } catch (parseError) {
            console.warn('태그 정의 파싱 실패:', parseError);
          }
        } else if (activity.tag === 'TAG_ITEM') {
          // 🔧 저장된 태그 아이템 복원
          try {
            const tagType = activity.tag_type || 'Unknown';
            const tagName = activity.title || 'Unknown';
            
            if (!tagItems.find(t => t.tagType === tagType && t.tagName === tagName)) {
              tagItems.push({ tagType, tagName });
            }
          } catch (parseError) {
            console.warn('태그 아이템 파싱 실패:', parseError);
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
              end: activity.end_time || '00:00',
              done: false
            });
            
            // 🔧 일정에서 태그 정보 추출
            const tagType = activity.tag_type || activity.tag || 'Unknown';
            const tagName = activity.tag || 'Unknown';
            
            uniqueTagTypes.add(tagType);
            
            if (!uniqueTagNames.has(tagType)) {
              uniqueTagNames.set(tagType, new Set());
            }
            uniqueTagNames.get(tagType).add(tagName);
            
          } catch (parseError) {
            console.warn('일정 파싱 실패:', parseError);
          }
        }
      });
    }
    
    // 🔧 저장된 태그가 없으면 일정에서 자동 생성
    if (tags.length === 0 && uniqueTagTypes.size > 0) {
      console.log('🔧 저장된 태그가 없어서 일정에서 자동 생성');
      let colorIndex = 0;
      uniqueTagTypes.forEach(tagType => {
        tags.push({
          tagType,
          color: PASTEL_COLORS[colorIndex % PASTEL_COLORS.length]
        });
        colorIndex++;
      });
    }
    
    // 🔧 저장된 태그 아이템이 없으면 일정에서 자동 생성
    if (tagItems.length === 0 && uniqueTagNames.size > 0) {
      console.log('🔧 저장된 태그 아이템이 없어서 일정에서 자동 생성');
      uniqueTagNames.forEach((tagNameSet, tagType) => {
        tagNameSet.forEach(tagName => {
          tagItems.push({ tagType, tagName });
        });
      });
    }
    
    console.log('🔍 최종 변환 결과:');
    console.log('- schedules:', schedules.length, '개');
    console.log('- tags:', tags.length, '개', tags);
    console.log('- tagItems:', tagItems.length, '개', tagItems);
    console.log('- monthlyGoals:', monthlyGoals.length, '개');
    
    return { 
      success: true, 
      data: {
        schedules,
        tags,
        tagItems,
        monthlyPlans: [],
        monthlyGoals
      }
    };
    
  } catch (error) {
    console.error('❌ 사용자 데이터 DAL 불러오기 실패:', error);
    return { success: false, data: null, error: error.message };
  }
};

// ✨ 새로운 스키마에 맞춘 개발자 도구 (태그 테스트 추가)
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
    
    // 🔧 태그 포함 테스트 데이터 생성
    createSampleUserData: async (nickname = '테스트유저_' + Date.now()) => {
      console.log('🧪 태그 포함 샘플 데이터 생성:', nickname);
      
      const sampleData = {
        schedules: [
          {
            id: Date.now(),
            title: '영어 공부',
            description: 'TOEIC 리스닝 연습',
            tag: '영어공부',
            tagType: '학습',
            date: new Date().toISOString().split('T')[0],
            start: '09:00',
            end: '10:30'
          },
          {
            id: Date.now() + 1,
            title: '헬스장 운동',
            description: '가슴, 삼두 운동',
            tag: '헬스',
            tagType: '운동',
            date: new Date().toISOString().split('T')[0],
            start: '18:00',
            end: '19:30'
          },
          {
            id: Date.now() + 2,
            title: '팀 회의',
            description: '주간 스프린트 리뷰',
            tag: '회의',
            tagType: '업무',
            date: new Date().toISOString().split('T')[0],
            start: '14:00',
            end: '15:00'
          }
        ],
        tags: [
          { tagType: "학습", color: { bg: "bg-blue-100", text: "text-blue-800" } },
          { tagType: "운동", color: { bg: "bg-green-100", text: "text-green-800" } },
          { tagType: "업무", color: { bg: "bg-red-100", text: "text-red-800" } }
        ],
        tagItems: [
          { tagType: "학습", tagName: "영어공부" },
          { tagType: "학습", tagName: "코딩" },
          { tagType: "운동", tagName: "헬스" },
          { tagType: "운동", tagName: "러닝" },
          { tagType: "업무", tagName: "회의" },
          { tagType: "업무", tagName: "개발" }
        ],
        monthlyGoals: [
          {
            month: new Date().toISOString().slice(0, 7),
            goals: [
              { tagType: '학습', targetHours: '02:00' },
              { tagType: '운동', targetHours: '01:30' },
              { tagType: '업무', targetHours: '08:00' }
            ]
          }
        ]
      };
      
      try {
        const saveResult = await saveUserDataToDAL(nickname, sampleData);
        if (!saveResult.success) {
          throw new Error('저장 실패: ' + saveResult.error);
        }
        
        // 잠깐 대기
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        const loadResult = await loadUserDataFromDAL(nickname);
        if (!loadResult.success) {
          throw new Error('불러오기 실패: ' + loadResult.error);
        }
        
        console.log('✅ 태그 포함 샘플 데이터 생성 완료');
        console.log('저장된 데이터:', saveResult.data);
        console.log('불러온 데이터:', loadResult.data);
        
        alert(`✅ 태그 포함 샘플 데이터 생성 완료!\n사용자: ${nickname}\n일정: ${loadResult.data.schedules?.length || 0}개\n태그: ${loadResult.data.tags?.length || 0}개\n태그아이템: ${loadResult.data.tagItems?.length || 0}개`);
        
        return { nickname, saveResult, loadResult };
        
      } catch (error) {
        console.error('❌ 샘플 데이터 생성 실패:', error);
        alert('❌ 샘플 데이터 생성 실패: ' + error.message);
        return { success: false, error: error.message };
      }
    },
    
    // ✨ 새로운 스키마에 맞춘 DAL 테스트
    testDAL: async () => {
      console.log('🧪 DAL 테스트 시작 (태그 포함)');
      
      if (!supabase) {
        console.error('❌ Supabase 초기화 실패');
        alert('❌ Supabase가 초기화되지 않았습니다');
        return false;
      }
      
      try {
        return await window.supabaseUtils.createSampleUserData();
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
    
    // ✨ 사용자별 데이터 확인
    checkUserData: async (nickname) => {
      if (!supabase || !nickname) {
        console.error('❌ Supabase 또는 nickname 없음');
        return false;
      }
      
      try {
        const { data, error } = await supabase
          .from('DAL')
          .select('*')
          .eq('user_name', nickname);
        
        if (error) throw error;
        
        console.log(`🔍 ${nickname} 사용자 데이터:`, data);
        
        const summary = {
          총_레코드: data?.length || 0,
          일정: data?.filter(d => !['MONTHLY_GOAL', 'TAG_DEFINITION', 'TAG_ITEM'].includes(d.tag)).length || 0,
          월간목표: data?.filter(d => d.tag === 'MONTHLY_GOAL').length || 0,
          태그정의: data?.filter(d => d.tag === 'TAG_DEFINITION').length || 0,
          태그아이템: data?.filter(d => d.tag === 'TAG_ITEM').length || 0
        };
        
        console.table(summary);
        alert(`${nickname} 데이터 요약:\n${JSON.stringify(summary, null, 2)}`);
        
        return data;
        
      } catch (error) {
        console.error('❌ 사용자 데이터 확인 실패:', error);
        alert('❌ 사용자 데이터 확인 실패: ' + error.message);
        return false;
      }
    }
  };
  
  if (supabase) {
    console.log('🚀 태그 기능이 포함된 Supabase 유틸리티가 준비되었습니다!');
    console.log('사용법:');
    console.log('  supabaseUtils.checkEnv() - 환경변수 확인');
    console.log('  supabaseUtils.testConnection() - 연결 테스트');
    console.log('  supabaseUtils.createSampleUserData() - 태그 포함 샘플 데이터 생성');
    console.log('  supabaseUtils.checkUserData("사용자명") - 특정 사용자 데이터 확인');
    console.log('  supabaseUtils.testDAL() - 전체 테스트');
  } else {
    console.warn('⚠️ Supabase 초기화 실패 - 환경변수를 확인하세요');
  }
}
