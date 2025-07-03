// Appcopy.jsx - 완전 서버 기반 버전 + 무한동기화 해결 + 데이터 로딩 완료 후 렌더링
import React, { useState, useEffect, useRef, useCallback } from "react";
import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import LogInPage from './pages/LogInPage';
import CalendarPage from './pages/CalendarPage';
import DayDetailPagecopy from './pages/DayDetailPagecopy';
import MonthlyPlanPage from './pages/MonthlyPlanPage';
import AdminDashboard from './pages/AdminDashboard';
import AdminMemberView from './pages/AdminMemberView';

// ✨ Supabase 전용 import (로컬 저장소 시스템 제거)
import { saveUserDataToDAL, loadUserDataFromDAL, supabase } from './pages/utils/supabaseStorage.js';

// ✨ 관리자 목록 상수 (LogInPage와 동일하게 유지)
const ADMIN_USERS = ['교수님', 'admin', '관리자'];

// 🔧 더욱 개선된 보호된 라우트 컴포넌트 (실시간 세션 체크)
const ProtectedRoute = ({ children, dataLoaded }) => {
  const currentUser = sessionStorage.getItem('currentUser');
  const userType = sessionStorage.getItem('userType');
  const isAdmin = userType === 'admin' || ADMIN_USERS.includes(currentUser);
  
  // 🔧 관리자이거나 로그인되지 않은 경우 dataLoaded 무시
  const shouldIgnoreDataLoaded = !currentUser || isAdmin;
  const canProceed = shouldIgnoreDataLoaded || dataLoaded;
  
  console.log('🛡️ ProtectedRoute 체크:', { 
    currentUser, 
    dataLoaded, 
    isAdmin,
    userType,
    shouldIgnoreDataLoaded,
    canProceed,
    timestamp: new Date().toISOString()
  });
  
  // 로그인되지 않은 경우
  if (!currentUser) {
    console.log('🚫 ProtectedRoute: 로그인 안됨 - /login으로 리다이렉트');
    return <Navigate to="/login" replace />;
  }
  
  // 관리자인 경우 데이터 로딩 완료 여부와 상관없이 진행
  if (isAdmin) {
    console.log('👑 ProtectedRoute: 관리자 - 즉시 통과');
    return children;
  }
  
  // 🔧 일반 사용자인 경우에만 데이터 로딩 완료까지 대기
  if (!canProceed) {
    console.log('⏳ ProtectedRoute: 데이터 로딩 미완료 - 로딩 화면 표시');
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-600">
            {currentUser}님의 개인 캘린더를 준비 중입니다...
          </p>
          <div className="mt-2 text-xs text-gray-500">
            <div className="space-y-1">
              <div>🌐 서버 데이터 로딩 중...</div>
              <div>📅 일정 정보 불러오기...</div>
              <div>🏷️ 태그 설정 확인...</div>
              <div>📊 월간 계획 동기화...</div>
              <div className="text-blue-600 mt-2">
                디버그: dataLoaded = {dataLoaded.toString()}
              </div>
            </div>
            
            {/* 🔧 강제 진행 버튼 - 더 빠른 타임아웃 */}
            <div className="mt-4 space-y-2">
              <button
                onClick={() => {
                  console.log('🚀 ProtectedRoute에서 강제 진행 요청');
                  // sessionStorage에 강제 완료 플래그 설정
                  sessionStorage.setItem('forceDataLoaded', 'true');
                  window.location.reload();
                }}
                className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600 transition-colors"
              >
                데이터 로딩 완료 - 강제 진행
              </button>
              
              <div className="text-xs text-gray-600">
                로그에서 "데이터 로딩 완료"가 보이면 위 버튼을 클릭하세요
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }
  
  console.log('✅ ProtectedRoute: 모든 조건 통과 - 컴포넌트 렌더링');
  return children;
};

// ✨ 수정된 관리자 전용 라우트 컴포넌트 (세션 기반)
const AdminRoute = ({ children }) => {
  const currentUser = sessionStorage.getItem('currentUser');
  const userType = sessionStorage.getItem('userType');
  
  // 더블 체크: userType이 admin이거나 nickname이 관리자 목록에 있는 경우
  const isAdmin = userType === 'admin' || ADMIN_USERS.includes(currentUser);
  
  console.log('🔍 AdminRoute 체크:', { currentUser, userType, isAdmin });
  
  return isAdmin ? children : <Navigate to="/calendar" replace />;
};

function Appcopy() {
  // ✨ 서버 기반 상태 관리
  const [schedules, setSchedules] = useState([]);
  const [tags, setTags] = useState([]);
  const [tagItems, setTagItems] = useState([]);
  const [monthlyPlans, setMonthlyPlans] = useState([]);
  const [monthlyGoals, setMonthlyGoals] = useState([]);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState('');
  const [isAdmin, setIsAdmin] = useState(false);
  
  // 🔧 dataLoaded 초기값을 sessionStorage 기반으로 설정
  const [dataLoaded, setDataLoaded] = useState(() => {
    const currentUser = sessionStorage.getItem('currentUser');
    const userType = sessionStorage.getItem('userType');
    const isAdmin = userType === 'admin' || ADMIN_USERS.includes(currentUser);
    
    // 관리자이거나 로그인되지 않은 경우 즉시 완료로 처리
    const initialDataLoaded = !currentUser || isAdmin;
    
    console.log('🚀 dataLoaded 초기값 설정:', {
      currentUser,
      userType,
      isAdmin,
      initialDataLoaded
    });
    
    return initialDataLoaded;
  });
  
  const [lastSyncTime, setLastSyncTime] = useState(null);
  
  // 🔧 새로 추가: 초기 로딩 상태 분리
  const [isInitializing, setIsInitializing] = useState(true);

  // 🔧 서버 저장 상태 관리 (무한동기화 방지 강화)
  const isSavingRef = useRef(false);
  const saveTimeoutRef = useRef(null);
  const lastSaveDataRef = useRef('');
  const prevDataRef = useRef({}); // ✅ 이전 데이터 상태 저장

  // ✨ 수정된 관리자 여부 확인 함수 (세션 기반)
  const checkIsAdmin = useCallback((nickname) => {
    const userType = sessionStorage.getItem('userType');
    
    const isAdminByType = userType === 'admin';
    const isAdminByName = ADMIN_USERS.includes(nickname);
    
    console.log('🔍 관리자 체크:', {
      nickname,
      userType,
      isAdminByType,
      isAdminByName,
      ADMIN_USERS,
      result: isAdminByType || isAdminByName
    });
    
    return isAdminByType || isAdminByName;
  }, []);

  // ✅ 데이터 깊은 비교 함수
  const deepCompare = useCallback((obj1, obj2) => {
    return JSON.stringify(obj1) === JSON.stringify(obj2);
  }, []);

  // 🔧 데이터 해시 생성 (변경 감지용) - 개선
  const generateDataHash = useCallback((schedules, tags, tagItems, monthlyPlans, monthlyGoals) => {
    return JSON.stringify({
      s: schedules?.length || 0,
      t: tags?.length || 0, 
      ti: tagItems?.length || 0,
      mp: monthlyPlans?.length || 0,
      mg: monthlyGoals?.length || 0,
      // 최근 데이터 샘플링으로 변경 감지 정확도 향상
      sData: schedules?.slice(-3) || [], // 최근 3개
      timestamp: Math.floor(Date.now() / 10000) // 10초 단위로 타임스탬프
    });
  }, []);

  // ✨ 서버에서 사용자 데이터 로드
  const loadUserDataFromServer = useCallback(async (nickname) => {
    if (!nickname || !supabase) return null;

    try {
      console.log('🌐 서버에서 사용자 데이터 로드:', nickname);

      const result = await loadUserDataFromDAL(nickname);
      
      if (result.success && result.data) {
        console.log('✅ 서버 데이터 로드 성공:', {
          schedules: result.data.schedules?.length || 0,
          tags: result.data.tags?.length || 0,
          tagItems: result.data.tagItems?.length || 0,
          monthlyPlans: result.data.monthlyPlans?.length || 0,
          monthlyGoals: result.data.monthlyGoals?.length || 0
        });

        return result.data;
      } else {
        console.warn('⚠️ 서버에 데이터 없음:', result.error);
        return null;
      }
    } catch (error) {
      console.error('❌ 서버 데이터 로드 실패:', error);
      return null;
    }
  }, []);

  // ✨ 개선된 서버에 사용자 데이터 저장 (무한동기화 방지 강화)
  const saveUserDataToServer = useCallback(async () => {
    if (!currentUser || isLoading || isAdmin) return;

    // 관리자는 데이터 저장 안 함
    if (checkIsAdmin(currentUser)) {
      console.log('⚠️ 관리자는 데이터 저장하지 않음');
      return;
    }

    // ✅ 현재 저장 중인지 확인 (강화)
    if (isSavingRef.current) {
      console.log('⚠️ 이미 저장 중 - 스킵');
      return;
    }

    // 데이터 변경 여부 확인
    const currentDataHash = generateDataHash(schedules, tags, tagItems, monthlyPlans, monthlyGoals);
    if (currentDataHash === lastSaveDataRef.current) {
      console.log('⚠️ 데이터 변경 없음 - 서버 저장 스킵');
      return;
    }

    isSavingRef.current = true;
    const previousHash = lastSaveDataRef.current;
    lastSaveDataRef.current = currentDataHash;

    try {
      console.log('🌐 서버 저장 시작:', currentUser);
      
      const dataToSave = {
        schedules: schedules || [],
        tags: tags || [],
        tagItems: tagItems || [],
        monthlyPlans: monthlyPlans || [],
        monthlyGoals: monthlyGoals || []
      };

      const result = await saveUserDataToDAL(currentUser, dataToSave);
      
      if (result.success) {
        console.log('✅ 서버 저장 완료:', currentUser);
        setLastSyncTime(new Date());
      } else {
        throw new Error(result.error || '서버 저장 실패');
      }
    } catch (error) {
      console.warn('⚠️ 서버 저장 실패:', error);
      // 저장 실패 시 해시 되돌리기
      lastSaveDataRef.current = previousHash;
    } finally {
      // ✅ 일정 시간 후 저장 플래그 해제 (네트워크 지연 고려)
      setTimeout(() => {
        isSavingRef.current = false;
      }, 2000); // 2초로 증가
    }
  }, [currentUser, isLoading, isAdmin, schedules, tags, tagItems, monthlyPlans, monthlyGoals, checkIsAdmin, generateDataHash]);

  // ✨ 서버에서 모든 사용자 목록 가져오기
  const getAllUsersFromServer = useCallback(async () => {
    if (!supabase) {
      console.error('❌ Supabase 클라이언트가 초기화되지 않았습니다');
      return [];
    }

    try {
      console.log('🔍 서버에서 모든 사용자 검색 시작');
      
      // DAL 테이블에서 모든 고유한 사용자 이름 가져오기
      const { data, error } = await supabase
        .from('DAL')
        .select('user_name')
        .order('user_name');

      if (error) {
        throw error;
      }

      // 중복 제거하여 고유한 사용자 목록 생성
      const uniqueUsers = [...new Set(data.map(item => item.user_name))].filter(userName => 
        userName && 
        userName.trim() !== '' &&
        !ADMIN_USERS.includes(userName)
      );

      console.log('✅ 서버에서 발견된 사용자들:', uniqueUsers);
      return uniqueUsers;

    } catch (error) {
      console.error('❌ 서버 사용자 검색 실패:', error);
      return [];
    }
  }, []);

  // ✨ 서버 기반 사용자 데이터 조회
  const getUserData = useCallback(async (nickname) => {
    if (!nickname) {
      console.warn('⚠️ getUserData: nickname이 없음');
      return {
        schedules: [],
        tags: [],
        tagItems: [],
        monthlyPlans: [],
        monthlyGoals: []
      };
    }

    console.log('📦 getUserData 서버 호출:', nickname);
    
    const userData = await loadUserDataFromServer(nickname);
    
    if (userData) {
      return userData;
    } else {
      // 빈 데이터 구조 반환
      return {
        schedules: [],
        tags: [],
        tagItems: [],
        monthlyPlans: [],
        monthlyGoals: []
      };
    }
  }, [loadUserDataFromServer]);

  // ✨ 서버 기반 사용자 통계
  const getUserStats = useCallback(async () => {
    console.log('📊 서버 기반 getUserStats 실행 시작');
    
    try {
      const users = await getAllUsersFromServer();
      console.log('📊 서버에서 가져온 사용자 목록:', users);
      
      const stats = {};
      
      for (const user of users) {
        console.log(`📊 ${user} 서버 데이터 통계 계산 중...`);
        try {
          const userData = await getUserData(user);
          
          if (userData) {
            stats[user] = {
              schedules: userData.schedules?.length || 0,
              tags: userData.tags?.length || 0,
              tagItems: userData.tagItems?.length || 0,
              monthlyPlans: userData.monthlyPlans?.length || 0,
              monthlyGoals: userData.monthlyGoals?.length || 0,
              lastActivity: '서버에서 조회'
            };
            console.log(`📊 ${user} 서버 기반 통계:`, stats[user]);
          }
        } catch (error) {
          console.error(`❌ ${user} 통계 계산 실패:`, error);
        }
      }
      
      console.log('📊 서버 기반 getUserStats 최종 결과:', stats);
      return stats;
      
    } catch (error) {
      console.error('❌ 서버 기반 getUserStats 실패:', error);
      return {};
    }
  }, [getAllUsersFromServer, getUserData]);

  // ✨ 🔧 디버깅 강화된 사용자 데이터 로드 함수 (서버 기반 + 완료 보장 + 강화된 에러 처리)
  const loadCurrentUserData = useCallback(async (nickname) => {
    let debugStep = 0;
    console.log(`📦 [LOAD STEP ${++debugStep}] loadCurrentUserData 함수 진입:`, nickname);
    
    if (!nickname) {
      console.warn(`⚠️ [LOAD STEP ${++debugStep}] nickname 없음 - 데이터 로딩 스킵`);
      setDataLoaded(true);
      return;
    }
    
    console.log(`📦 [LOAD STEP ${++debugStep}] 서버 기반 데이터 로딩 시작:`, nickname);
    
    try {
      console.log(`🔍 [LOAD STEP ${++debugStep}] 관리자 체크 시작`);
      // 먼저 관리자 여부를 확인
      const isUserAdmin = checkIsAdmin(nickname);
      console.log(`👑 [LOAD STEP ${++debugStep}] 관리자 체크 결과:`, { nickname, isUserAdmin });
      
      // 관리자인 경우
      if (isUserAdmin) {
        console.log(`👑 [LOAD STEP ${++debugStep}] 관리자 로그인 - 데이터 로딩 스킵`);
        setIsAdmin(true);
        console.log(`👑 [LOAD STEP ${++debugStep}] 관리자 상태 설정 완료 - 함수 종료`);
        return; // 함수 종료 - finally에서 setDataLoaded(true) 실행됨
      }
      
      console.log(`👤 [LOAD STEP ${++debugStep}] 일반 사용자 처리 시작`);
      // 일반 사용자 데이터 로딩
      setIsAdmin(false);
      console.log(`📦 [LOAD STEP ${++debugStep}] 일반 사용자 서버 데이터 로딩 시작:`, nickname);
      
      console.log(`🌐 [LOAD STEP ${++debugStep}] loadUserDataFromServer 호출 직전`);
      // 서버에서 데이터 로드
      const userData = await loadUserDataFromServer(nickname);
      console.log(`🌐 [LOAD STEP ${++debugStep}] loadUserDataFromServer 호출 완료:`, userData ? '데이터 있음' : '데이터 없음');
      
      if (userData) {
        // 서버 데이터가 있는 경우
        console.log(`✅ [LOAD STEP ${++debugStep}] 서버 데이터 적용 시작`);
        
        // 🔧 상태 업데이트를 순차적으로 진행
        console.log(`📝 [LOAD STEP ${++debugStep}] 상태 업데이트 시작 - schedules`);
        setSchedules(userData.schedules || []);
        console.log(`📝 [LOAD STEP ${++debugStep}] 상태 업데이트 - tags`);
        setTags(userData.tags || []);
        console.log(`📝 [LOAD STEP ${++debugStep}] 상태 업데이트 - tagItems`);
        setTagItems(userData.tagItems || []);
        console.log(`📝 [LOAD STEP ${++debugStep}] 상태 업데이트 - monthlyPlans`);
        setMonthlyPlans(userData.monthlyPlans || []);
        console.log(`📝 [LOAD STEP ${++debugStep}] 상태 업데이트 - monthlyGoals`);
        setMonthlyGoals(userData.monthlyGoals || []);
        
        console.log(`🔧 [LOAD STEP ${++debugStep}] 데이터 해시 설정 시작`);
        // ✅ 초기 데이터 해시 설정
        prevDataRef.current = {
          schedules: userData.schedules || [],
          tags: userData.tags || [],
          tagItems: userData.tagItems || [],
          monthlyPlans: userData.monthlyPlans || [],
          monthlyGoals: userData.monthlyGoals || []
        };
        
        // 초기 데이터 해시 설정
        lastSaveDataRef.current = generateDataHash(
          userData.schedules || [],
          userData.tags || [],
          userData.tagItems || [],
          userData.monthlyPlans || [],
          userData.monthlyGoals || []
        );
        
        console.log(`✅ [LOAD STEP ${++debugStep}] 서버 데이터 로딩 완료:`, {
          nickname,
          schedulesCount: userData.schedules?.length || 0,
          tagsCount: userData.tags?.length || 0,
          tagItemsCount: userData.tagItems?.length || 0,
          monthlyPlansCount: userData.monthlyPlans?.length || 0,
          monthlyGoalsCount: userData.monthlyGoals?.length || 0
        });
      } else {
        // 서버에 데이터가 없는 경우 - 신규 사용자
        console.log(`🆕 [LOAD STEP ${++debugStep}] 신규 사용자 - 기본 데이터 구조 생성:`, nickname);
        
        const defaultTags = [
          { tagType: '공부', color: { bg: 'bg-blue-100', text: 'text-blue-800', border: 'border-blue-200' } },
          { tagType: '운동', color: { bg: 'bg-green-100', text: 'text-green-800', border: 'border-green-200' } },
          { tagType: '취미', color: { bg: 'bg-purple-100', text: 'text-purple-800', border: 'border-purple-200' } },
          { tagType: '업무', color: { bg: 'bg-red-100', text: 'text-red-800', border: 'border-red-200' } }
        ];
        
        const defaultTagItems = [
          { tagType: '공부', tagName: '독서' },
          { tagType: '공부', tagName: '강의 수강' },
          { tagType: '공부', tagName: '과제' },
          { tagType: '운동', tagName: '조깅' },
          { tagType: '운동', tagName: '헬스장' },
          { tagType: '취미', tagName: '음악 감상' },
          { tagType: '취미', tagName: '영화 관람' },
          { tagType: '업무', tagName: '회의' },
          { tagType: '업무', tagName: '프로젝트' }
        ];
        
        console.log(`📝 [LOAD STEP ${++debugStep}] 신규 사용자 기본 데이터 설정 시작`);
        // 신규 사용자 기본 데이터 설정
        setSchedules([]);
        setTags(defaultTags);
        setTagItems(defaultTagItems);
        setMonthlyPlans([]);
        setMonthlyGoals([]);
        
        console.log(`🔧 [LOAD STEP ${++debugStep}] 신규 사용자 데이터 해시 설정`);
        // ✅ 초기 데이터 해시 설정
        prevDataRef.current = {
          schedules: [],
          tags: defaultTags,
          tagItems: defaultTagItems,
          monthlyPlans: [],
          monthlyGoals: []
        };
        
        // 초기 데이터 해시 설정
        lastSaveDataRef.current = generateDataHash(
          [],
          defaultTags,
          defaultTagItems,
          [],
          []
        );
        
        console.log(`💾 [LOAD STEP ${++debugStep}] 기본 데이터 서버 저장 시도 (비차단)`);
        // 기본 데이터를 서버에 저장 (비동기, 실패해도 진행)
        try {
          const initialData = {
            schedules: [],
            tags: defaultTags,
            tagItems: defaultTagItems,
            monthlyPlans: [],
            monthlyGoals: []
          };
          
          const saveResult = await saveUserDataToDAL(nickname, initialData);
          if (saveResult.success) {
            console.log(`💾 [LOAD STEP ${++debugStep}] 신규 사용자 기본 데이터 서버 저장 완료`);
          } else {
            console.warn(`⚠️ [LOAD STEP ${++debugStep}] 기본 데이터 저장 실패 (진행 계속):`, saveResult.error);
          }
        } catch (saveError) {
          console.warn(`⚠️ [LOAD STEP ${++debugStep}] 기본 데이터 저장 중 오류 (진행 계속):`, saveError);
        }
      }
      
      console.log(`⏰ [LOAD STEP ${++debugStep}] 동기화 시간 설정`);
      setLastSyncTime(new Date());
      console.log(`✅ [LOAD STEP ${++debugStep}] loadCurrentUserData try 블록 성공 완료`);
      
    } catch (error) {
      console.error(`❌ [LOAD STEP ${++debugStep}] 서버 데이터 로딩 실패:`, error);
      
      console.log(`🔄 [LOAD STEP ${++debugStep}] 실패 시 빈 상태로 초기화`);
      // 실패 시 빈 상태로 초기화
      setSchedules([]);
      setTags([]);
      setTagItems([]);
      setMonthlyPlans([]);
      setMonthlyGoals([]);
      
      prevDataRef.current = {
        schedules: [],
        tags: [],
        tagItems: [],
        monthlyPlans: [],
        monthlyGoals: []
      };
    } finally {
      // 🔧 중요: 무조건 데이터 로딩 완료 표시
      console.log(`🎯 [LOAD STEP ${++debugStep}] loadCurrentUserData 최종 단계 - 데이터 로딩 완료 플래그 설정`);
      setDataLoaded(true);
      console.log(`🏁 [LOAD STEP ${++debugStep}] loadCurrentUserData 함수 완전 종료`);
    }
  }, [checkIsAdmin, loadUserDataFromServer, generateDataHash]);

  // ✨ 🔧 강제 완료 플래그 확인 및 적용
  useEffect(() => {
    const forceFlag = sessionStorage.getItem('forceDataLoaded');
    if (forceFlag === 'true') {
      console.log('🚀 강제 완료 플래그 감지 - 즉시 완료 처리');
      setDataLoaded(true);
      setIsLoading(false);
      setIsInitializing(false);
      // 플래그 제거
      sessionStorage.removeItem('forceDataLoaded');
    }
  }, []);

  // ✨ 🔧 디버깅 강화된 로그인 상태 확인 (세션 기반 + 완료 보장 + 타임아웃)
  useEffect(() => {
    let debugStep = 0;
    
    const checkLoginStatus = async () => {
      console.log(`🔐 [STEP ${++debugStep}] 로그인 상태 확인 시작 (세션 기반)`);
      
      // 🔧 안전장치: 3초 후 강제 완료 (빠른 테스트)
      const safetyTimeout = setTimeout(() => {
        console.warn(`⚠️ [STEP ${++debugStep}] 로딩 타임아웃 - 강제 완료`);
        setDataLoaded(true);
        setIsLoading(false);
        setIsInitializing(false);
      }, 3000); // 3초로 단축
      
      try {
        console.log(`📍 [STEP ${++debugStep}] 세션 스토리지 확인 중...`);
        const currentUser = sessionStorage.getItem('currentUser');
        const userType = sessionStorage.getItem('userType');
        
        console.log(`🔐 [STEP ${++debugStep}] 저장된 세션 정보:`, { currentUser, userType });
        
        if (currentUser) {
          console.log(`👤 [STEP ${++debugStep}] 사용자 발견 - 로그인 상태 설정`);
          // 로그인 상태 먼저 설정
          setIsLoggedIn(true);
          setCurrentUser(currentUser);
          
          // 🔧 관리자인 경우 데이터 로딩 스킵
          const isUserAdmin = userType === 'admin' || ADMIN_USERS.includes(currentUser);
          if (isUserAdmin) {
            console.log(`👑 [STEP ${++debugStep}] 관리자 확인 - 데이터 로딩 스킵`);
            setIsAdmin(true);
            setDataLoaded(true);
          } else {
            console.log(`📦 [STEP ${++debugStep}] 일반 사용자 - 데이터 로딩 시작...`);
            
            console.log(`🚀 [STEP ${++debugStep}] loadCurrentUserData 호출 직전`);
            await loadCurrentUserData(currentUser);
            console.log(`✅ [STEP ${++debugStep}] loadCurrentUserData 호출 완료`);
          }
          
          console.log(`✅ [STEP ${++debugStep}] 서버 기반 모든 초기화 완료`);
        } else {
          console.log(`❌ [STEP ${++debugStep}] 세션 정보 없음 - 로그인 페이지로`);
          setDataLoaded(true); // 로그인 안 된 상태도 완료로 처리
        }
      } catch (error) {
        console.error(`❌ [STEP ${++debugStep}] 초기화 중 오류:`, error);
        setDataLoaded(true); // 오류 발생 시에도 완료로 처리
      } finally {
        // 타임아웃 해제
        clearTimeout(safetyTimeout);
        
        // 🔧 중요: 무조건 로딩 완료 처리
        console.log(`🎯 [STEP ${++debugStep}] 초기화 최종 단계 - 로딩 상태 해제`);
        setIsLoading(false);
        setIsInitializing(false);
        
        console.log(`🏁 [STEP ${++debugStep}] checkLoginStatus 함수 완전 종료`);
      }
    };
    
    console.log(`🎬 [STEP ${++debugStep}] useEffect 시작 - checkLoginStatus 호출`);
    checkLoginStatus()
      .then(() => {
        console.log(`🎉 [STEP ${++debugStep}] checkLoginStatus Promise 완료`);
      })
      .catch((error) => {
        console.error(`💥 [STEP ${++debugStep}] checkLoginStatus Promise 에러:`, error);
        // 에러 발생시에도 강제 완료
        setDataLoaded(true);
        setIsLoading(false);
        setIsInitializing(false);
      });
    
    // 클린업 함수도 로그 추가
    return () => {
      console.log(`🧹 [CLEANUP] useEffect 클린업 실행`);
    };
  }, [loadCurrentUserData]);

  // ✅ 개선된 자동 저장 로직 (무한 루프 방지 강화)
  useEffect(() => {
    if (!currentUser || isLoading || isAdmin || !dataLoaded) return;

    const currentData = {
      schedules: schedules || [],
      tags: tags || [],
      tagItems: tagItems || [],
      monthlyPlans: monthlyPlans || [],
      monthlyGoals: monthlyGoals || []
    };

    // ✅ 이전 데이터와 깊은 비교하여 실제 변경이 있을 때만 저장
    if (!deepCompare(currentData, prevDataRef.current)) {
      console.log('📝 데이터 변경 감지 - 저장 예약');
      
      // 기존 타이머 취소
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }

      // ✅ 5초 디바운싱 (더 긴 간격으로 조정)
      saveTimeoutRef.current = setTimeout(() => {
        saveUserDataToServer();
        // 저장 후 이전 데이터 업데이트
        prevDataRef.current = { ...currentData };
      }, 5000);
    }

    // 클린업
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [schedules, tags, tagItems, monthlyPlans, monthlyGoals, currentUser, isLoading, isAdmin, dataLoaded, deepCompare, saveUserDataToServer]);

  // ✅ 상태 업데이트 함수들을 useCallback으로 최적화
  const updateSchedules = useCallback((newSchedules) => {
    setSchedules(newSchedules);
    console.log('📅 일정 상태 업데이트:', newSchedules?.length || 0, '개');
  }, []);

  const updateTags = useCallback((newTags) => {
    setTags(newTags);
    console.log('🏷️ 태그 상태 업데이트:', newTags?.length || 0, '개');
  }, []);

  const updateTagItems = useCallback((newTagItems) => {
    setTagItems(newTagItems);
    console.log('📋 태그아이템 상태 업데이트:', newTagItems?.length || 0, '개');
  }, []);

  const updateMonthlyPlans = useCallback((newPlans) => {
    setMonthlyPlans(newPlans);
    console.log('📊 월간계획 상태 업데이트:', newPlans?.length || 0, '개');
  }, []);

  const updateMonthlyGoals = useCallback((newGoals) => {
    setMonthlyGoals(newGoals);
    console.log('🎯 월간목표 상태 업데이트:', newGoals?.length || 0, '개');
  }, []);

  // ✨ 수정된 로그아웃 함수 (세션 기반)
  const handleLogout = useCallback(() => {
    console.log('🚪 로그아웃 시작 (세션 기반)');
    
    // 타이머 정리
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    
    // 세션 정리 (서버 데이터는 보존)
    sessionStorage.clear();
    
    // 상태 초기화
    setIsLoggedIn(false);
    setCurrentUser('');
    setSchedules([]);
    setTags([]);
    setTagItems([]);
    setMonthlyPlans([]);
    setMonthlyGoals([]);
    setIsAdmin(false);
    setDataLoaded(false);
    setIsLoading(false);
    setIsInitializing(false);
    setLastSyncTime(null);
    
    // 플래그 초기화
    isSavingRef.current = false;
    lastSaveDataRef.current = '';
    prevDataRef.current = {};
    
    console.log('🚪 로그아웃 완료 - 로그인 페이지로 이동');
    
    // 강제 페이지 이동
    window.location.href = '#/login';
  }, []);

  const handleAdminLogout = useCallback(() => {
    console.log('👑 관리자 로그아웃 (세션 기반)');
    handleLogout();
  }, [handleLogout]);

  // 컴포넌트 언마운트 시 정리
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, []);

  // ✨ 🔧 개선된 로딩 화면 (서버 기반 + 초기화 상태 체크 + 강제 진행)
  if (isInitializing || isLoading || !dataLoaded) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-600">
            {currentUser ? 
              (checkIsAdmin(currentUser) ? '관리자 권한 확인 중...' : `${currentUser}님의 서버 데이터를 불러오는 중...`) : 
              '로그인 정보 확인 중...'
            }
          </p>
          <div className="mt-2 text-xs text-gray-500">
            {currentUser && !checkIsAdmin(currentUser) && (
              <div className="space-y-1">
                <div>🌐 Supabase 서버 연결 중...</div>
                <div>📅 일정 데이터 로딩...</div>
                <div>🏷️ 태그 설정 확인...</div>
                <div>📊 월간 계획 불러오기...</div>
                <div className="text-blue-600 mt-2">
                  🔄 데이터 로딩 완료 후 자동으로 이동합니다
                </div>
              </div>
            )}
            {lastSyncTime && (
              <div className="text-green-600 mt-2">
                마지막 동기화: {lastSyncTime.toLocaleTimeString('ko-KR')}
              </div>
            )}
            
            {/* 🔧 강제 진행 버튼 추가 */}
            <div className="mt-4">
              <button
                onClick={() => {
                  console.log('🚀 사용자가 강제 진행 요청');
                  setDataLoaded(true);
                  setIsLoading(false);
                  setIsInitializing(false);
                }}
                className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
              >
                로딩이 오래 걸리면 여기를 클릭하세요
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <Router>
      <Routes>
        <Route path="/login" element={<LogInPage />} />
        
        {/* ✨ 🔧 개선된 루트 라우팅 (세션 기반 + 데이터 로딩 완료 확인) */}
        <Route
          path="/"
          element={(() => {
            if (!isLoggedIn || !dataLoaded) {
              return <Navigate to="/login" replace />;
            }
            
            // 세션에서 직접 체크
            const currentUser = sessionStorage.getItem('currentUser');
            const userType = sessionStorage.getItem('userType');
            const isDirectAdmin = userType === 'admin' || ADMIN_USERS.includes(currentUser);
            
            console.log('🏠 루트 라우팅 (세션 기반 + 데이터 완료):', {
              currentUser,
              userType,
              isDirectAdmin,
              dataLoaded,
              targetRoute: isDirectAdmin ? '/admin' : '/calendar'
            });
            
            return isDirectAdmin ? 
              <Navigate to="/admin" replace /> : 
              <Navigate to="/calendar" replace />;
          })()}
        />

        <Route
          path="/admin/member/:memberName"
          element={
            <AdminRoute>
              <AdminMemberView
                currentUser={currentUser}
                onLogout={handleAdminLogout}
                getUserData={getUserData}
              />
            </AdminRoute>
          }
        />

        <Route
          path="/admin"
          element={
            <AdminRoute>
              <AdminDashboard
                currentUser={currentUser}
                onLogout={handleAdminLogout}
                getAllUsers={getAllUsersFromServer}
                getUserData={getUserData}
                getUserStats={getUserStats}
              />
            </AdminRoute>
          }
        />

        {/* ✅ 🔧 개선된 보호된 라우트: 데이터 로딩 완료까지 대기 + 디버깅 */}
        <Route
          path="/calendar"
          element={
            <ProtectedRoute dataLoaded={dataLoaded}>
              {(() => {
                console.log('📅 CalendarPage 렌더링 시점 상태:', {
                  dataLoaded,
                  isLoading,
                  isInitializing,
                  currentUser,
                  schedulesCount: schedules?.length || 0
                });
                
                return (
                  <CalendarPage
                    schedules={schedules}
                    setSchedules={updateSchedules}
                    tags={tags}
                    setTags={updateTags}
                    tagItems={tagItems}
                    setTagItems={updateTagItems}
                    monthlyGoals={monthlyGoals}
                    setMonthlyGoals={updateMonthlyGoals}
                    currentUser={currentUser}
                    onLogout={handleLogout}
                    lastSyncTime={lastSyncTime}
                    isServerBased={true}
                  />
                );
              })()}
            </ProtectedRoute>
          }
        />

        <Route
          path="/day/:date"
          element={
            <ProtectedRoute dataLoaded={dataLoaded}>
              <DayDetailPagecopy
                schedules={schedules}
                setSchedules={updateSchedules}
                tags={tags}
                setTags={updateTags}
                tagItems={tagItems}
                setTagItems={updateTagItems}
                currentUser={currentUser}
                onLogout={handleLogout}
                lastSyncTime={lastSyncTime}
                isServerBased={true}
              />
            </ProtectedRoute>
          }
        />

        <Route
          path="/monthly-plan"
          element={
            <ProtectedRoute dataLoaded={dataLoaded}>
              <MonthlyPlanPage
                schedules={schedules}
                setSchedules={updateSchedules}
                tags={tags}
                setTags={updateTags}
                tagItems={tagItems}
                setTagItems={updateTagItems}
                monthlyPlans={monthlyPlans}
                setMonthlyPlans={updateMonthlyPlans}
                monthlyGoals={monthlyGoals}
                setMonthlyGoals={updateMonthlyGoals}
                currentUser={currentUser}
                onLogout={handleLogout}
                lastSyncTime={lastSyncTime}
                isServerBased={true}
              />
            </ProtectedRoute>
          }
        />
      </Routes>
    </Router>
  );
}

export default Appcopy;
