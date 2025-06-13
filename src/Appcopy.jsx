// Appcopy.jsx - 로그인 라우팅 문제 해결 버전
import React, { useState, useEffect, useRef } from "react";
import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import LogInPage from './pages/LogInPage';
import CalendarPage from './pages/CalendarPage';
import DayDetailPagecopy from './pages/DayDetailPagecopy';
import MonthlyPlanPage from './pages/MonthlyPlanPage';
import AdminDashboard from './pages/AdminDashboard';
import AdminMemberView from './pages/AdminMemberView';

// 기존 저장 시스템
import {
  loadAllUserData,
  saveUserCoreData,
  saveSchedulesToStorage,
  saveTagsToStorage,
  saveTagItemsToStorage,
  saveMonthlyPlansToStorage,
  saveMonthlyGoalsToStorage,
  backupToServer,
  restoreFromServer,
  loadUserDataWithFallback,
  getUserKeys,
  debugStorage
} from './pages/utils/unifiedStorage';

// ✨ Supabase DAL 기능 추가
import './pages/utils/supabaseStorage.js';

// 보호된 라우트 컴포넌트
const ProtectedRoute = ({ children }) => {
  const nickname = localStorage.getItem('nickname');
  return nickname ? children : <Navigate to="/login" replace />;
};

// 관리자 전용 라우트 컴포넌트
const AdminRoute = ({ children }) => {
  const nickname = localStorage.getItem('nickname');
  const isAdmin = nickname === 'admin' || nickname === '관리자';
  return isAdmin ? children : <Navigate to="/calendar" replace />;
};

function Appcopy() {
  // 기존 상태들
  const [schedules, setSchedules] = useState([]);
  const [tags, setTags] = useState([]);
  const [tagItems, setTagItems] = useState([]);
  const [monthlyPlans, setMonthlyPlans] = useState([]);
  const [monthlyGoals, setMonthlyGoals] = useState([]);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState('');
  
  // ✨ 새로 추가: 관리자 여부 상태
  const [isAdmin, setIsAdmin] = useState(false);
  const [dataLoaded, setDataLoaded] = useState(false);

  // 🔧 중복 저장 방지용 플래그들
  const isSavingRef = useRef(false);
  const saveTimeoutRef = useRef(null);
  const lastSaveDataRef = useRef('');

  // 🔧 관리자 여부 확인 함수
  const checkIsAdmin = (nickname) => {
    return nickname === 'admin' || nickname === '관리자';
  };

  // 🔧 데이터 해시 생성 (변경 감지용)
  const generateDataHash = (schedules, tags, tagItems, monthlyPlans, monthlyGoals) => {
    return JSON.stringify({
      s: schedules.length,
      t: tags.length, 
      ti: tagItems.length,
      mp: monthlyPlans.length,
      mg: monthlyGoals.length
    });
  };

  // 🔧 안전한 서버 저장 (중복 실행 완전 차단)
  const safeServerSave = async () => {
    if (!currentUser || isLoading || isSavingRef.current || isAdmin) return;

    // 관리자는 데이터 저장 안 함
    if (checkIsAdmin(currentUser)) {
      console.log('⚠️ 관리자는 데이터 저장하지 않음');
      return;
    }

    // 데이터 변경 여부 확인
    const currentDataHash = generateDataHash(schedules, tags, tagItems, monthlyPlans, monthlyGoals);
    if (currentDataHash === lastSaveDataRef.current) {
      console.log('⚠️ 데이터 변경 없음 - 서버 저장 스킵');
      return;
    }

    isSavingRef.current = true;
    lastSaveDataRef.current = currentDataHash;

    try {
      console.log('🌐 서버 저장 시작:', currentUser);
      
      await saveUserCoreData(currentUser, {
        schedules, tags, tagItems, monthlyPlans, monthlyGoals
      });
      
      console.log('✅ 서버 저장 완료:', currentUser);
    } catch (error) {
      console.warn('⚠️ 서버 저장 실패 (로컬은 저장됨):', error);
    } finally {
      isSavingRef.current = false;
    }
  };

  // 기존 함수들
  const getAllUsers = () => {
    const users = new Set();
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.includes('-')) {
        const [nickname] = key.split('-');
        if (nickname && nickname !== 'admin' && nickname !== '관리자') {
          users.add(nickname);
        }
      }
    }
    return Array.from(users);
  };

  const getUserData = (nickname) => {
    if (!nickname) return {
      schedules: [],
      tags: [],
      tagItems: [],
      monthlyPlans: [],
      monthlyGoals: []
    };
    return loadAllUserData(nickname);
  };

  const getUserStats = () => {
    const users = getAllUsers();
    const stats = {};
    users.forEach(user => {
      const userData = loadAllUserData(user);
      stats[user] = {
        schedules: userData.schedules?.length || 0,
        tags: userData.tags?.length || 0,
        tagItems: userData.tagItems?.length || 0,
        monthlyPlans: userData.monthlyPlans?.length || 0,
        monthlyGoals: userData.monthlyGoals?.length || 0,
        lastActivity: '오늘'
      };
    });
    return stats;
  };

  // 수동 동기화
  const handleManualServerSync = async (showConfirm = true) => {
    if (!currentUser || isAdmin) return false;

    if (showConfirm && !window.confirm('수동으로 서버와 동기화하시겠습니까?')) {
      return false;
    }

    try {
      console.log('🔧 수동 서버 동기화 시작:', currentUser);
      await safeServerSave();
      alert('✅ 서버 동기화가 완료되었습니다!');
      return true;
    } catch (error) {
      console.error('❌ 수동 서버 동기화 실패:', error);
      alert('❌ 서버 동기화 실패');
      return false;
    }
  };

  // ✨ 개선된 사용자 데이터 로드 함수 (관리자 구분)
  const loadCurrentUserData = async (nickname) => {
    if (!nickname) return;
    
    // 관리자인 경우 데이터 로딩 스킵
    if (checkIsAdmin(nickname)) {
      console.log('👑 관리자 로그인 - 데이터 로딩 스킵:', nickname);
      setIsAdmin(true);
      setDataLoaded(true);
      setIsLoading(false);
      return;
    }
    
    try {
      setIsLoading(true);
      setIsAdmin(false);
      console.log('📦 일반 사용자 데이터 로딩 시작:', nickname);
      
      let userData = await loadUserDataWithFallback(nickname);
      
      if (!userData || 
          !userData.tags || userData.tags.length === 0 ||
          !userData.tagItems || userData.tagItems.length === 0) {
        
        console.log('🆕 새 사용자 또는 빈 데이터 감지, 기본 데이터 생성 중...');
        
        userData = {
          schedules: userData?.schedules || [],
          tags: [
            { tagType: '공부', color: { bg: 'bg-blue-100', text: 'text-blue-800' } },
            { tagType: '운동', color: { bg: 'bg-green-100', text: 'text-green-800' } },
            { tagType: '취미', color: { bg: 'bg-purple-100', text: 'text-purple-800' } },
            { tagType: '업무', color: { bg: 'bg-red-100', text: 'text-red-800' } }
          ],
          tagItems: [
            { tagType: '공부', tagName: '독서' },
            { tagType: '공부', tagName: '강의 수강' },
            { tagType: '공부', tagName: '과제' },
            { tagType: '운동', tagName: '조깅' },
            { tagType: '운동', tagName: '헬스장' },
            { tagType: '취미', tagName: '음악 감상' },
            { tagType: '취미', tagName: '영화 관람' },
            { tagType: '업무', tagName: '회의' },
            { tagType: '업무', tagName: '프로젝트' }
          ],
          monthlyPlans: userData?.monthlyPlans || [],
          monthlyGoals: userData?.monthlyGoals || []
        };
      }
      
      // 상태 설정 (한 번에)
      setSchedules(userData.schedules || []);
      setTags(userData.tags || []);
      setTagItems(userData.tagItems || []);
      setMonthlyPlans(userData.monthlyPlans || []);
      setMonthlyGoals(userData.monthlyGoals || []);
      
      // 초기 데이터 해시 설정
      lastSaveDataRef.current = generateDataHash(
        userData.schedules || [],
        userData.tags || [],
        userData.tagItems || [],
        userData.monthlyPlans || [],
        userData.monthlyGoals || []
      );
      
      console.log('✅ 일반 사용자 데이터 로딩 완료:', {
        nickname,
        schedulesCount: userData.schedules?.length || 0,
        tagsCount: userData.tags?.length || 0,
        tagItemsCount: userData.tagItems?.length || 0,
        monthlyPlansCount: userData.monthlyPlans?.length || 0,
        monthlyGoalsCount: userData.monthlyGoals?.length || 0
      });
      
      setDataLoaded(true);
      
    } catch (error) {
      console.error('❌ 사용자 데이터 로딩 실패:', error);
      
      setSchedules([]);
      setTags([]);
      setTagItems([]);
      setMonthlyPlans([]);
      setMonthlyGoals([]);
      setDataLoaded(true);
      
    } finally {
      setIsLoading(false);
    }
  };

  // ✨ 개선된 로그인 상태 확인 (데이터 로딩 완료 후 라우팅)
  useEffect(() => {
    const checkLoginStatus = async () => {
      const nickname = localStorage.getItem('nickname');
      if (nickname) {
        console.log('🔐 저장된 로그인 정보 확인:', nickname);
        setIsLoggedIn(true);
        setCurrentUser(nickname);
        
        // 데이터 로딩 완료까지 대기
        await loadCurrentUserData(nickname);
      } else {
        setIsLoading(false);
        setDataLoaded(true);
      }
    };
    checkLoginStatus();
  }, []);

  // 🔧 일반 사용자만 자동 저장 (1초 디바운싱)
  useEffect(() => {
    if (!currentUser || isLoading || isAdmin || !dataLoaded) return;

    // 기존 타이머 취소
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    // 1초 디바운싱
    saveTimeoutRef.current = setTimeout(() => {
      safeServerSave();
    }, 1000);

    // 클린업
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [schedules, tags, tagItems, monthlyPlans, monthlyGoals, currentUser, isLoading, isAdmin, dataLoaded]);

  // 🔧 상태 업데이트 함수들 (관리자는 저장 안 함)
  const updateSchedules = (newSchedules) => {
    setSchedules(newSchedules);
    // 일반 사용자만 로컬 저장
    if (currentUser && !isAdmin) {
      saveSchedulesToStorage(currentUser, newSchedules);
      console.log('💾 일정 즉시 로컬 저장:', newSchedules.length, '개');
    }
  };

  const updateTags = (newTags) => {
    setTags(newTags);
    if (currentUser && !isAdmin) {
      saveTagsToStorage(currentUser, newTags);
      console.log('💾 태그 즉시 로컬 저장:', newTags.length, '개');
    }
  };

  const updateTagItems = (newTagItems) => {
    setTagItems(newTagItems);
    if (currentUser && !isAdmin) {
      saveTagItemsToStorage(currentUser, newTagItems);
      console.log('💾 태그아이템 즉시 로컬 저장:', newTagItems.length, '개');
    }
  };

  const updateMonthlyPlans = (newPlans) => {
    setMonthlyPlans(newPlans);
    if (currentUser && !isAdmin) {
      saveMonthlyPlansToStorage(currentUser, newPlans);
      console.log('💾 월간계획 즉시 로컬 저장:', newPlans.length, '개');
    }
  };

  const updateMonthlyGoals = (newGoals) => {
    setMonthlyGoals(newGoals);
    if (currentUser && !isAdmin) {
      saveMonthlyGoalsToStorage(currentUser, newGoals);
      console.log('💾 월간목표 즉시 로컬 저장:', newGoals.length, '개');
    }
  };

  // ✨ 개선된 로그아웃 함수
  const handleLogout = () => {
    // 타이머 정리
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    
    localStorage.removeItem('nickname');
    setIsLoggedIn(false);
    setCurrentUser('');
    setSchedules([]);
    setTags([]);
    setTagItems([]);
    setMonthlyPlans([]);
    setMonthlyGoals([]);
    
    // 새로 추가된 상태들 초기화
    setIsAdmin(false);
    setDataLoaded(false);
    
    // 플래그 초기화
    isSavingRef.current = false;
    lastSaveDataRef.current = '';
    
    console.log('🚪 로그아웃 완료');
  };

  const handleAdminLogout = () => {
    handleLogout();
  };

  // 컴포넌트 언마운트 시 정리
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, []);

  // ✨ 개선된 로딩 화면 (더 구체적인 상태 표시)
  if (isLoading || !dataLoaded) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-600">
            {isAdmin ? '관리자 권한 확인 중...' : '사용자 데이터를 불러오는 중...'}
          </p>
          <p className="text-sm text-gray-500 mt-2">
            {currentUser ? `${currentUser}님의 데이터 로딩 중...` : '로그인 정보 확인 중...'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <Router>
      <Routes>
        <Route path="/login" element={<LogInPage />} />
        
        {/* ✨ 개선된 루트 라우팅 (데이터 로딩 완료 후) */}
        <Route
          path="/"
          element={
            isLoggedIn && dataLoaded ? (
              isAdmin ?
                <Navigate to="/admin" replace /> :
                <Navigate to="/calendar" replace />
            ) : (
              <Navigate to="/login" replace />
            )
          }
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
                getAllUsers={getAllUsers}
                getUserStats={getUserStats}
                getUserData={getUserData}
              />
            </AdminRoute>
          }
        />

        <Route
          path="/calendar"
          element={
            <ProtectedRoute>
              <CalendarPage
                schedules={schedules}
                setSchedules={updateSchedules}
                tags={tags}
                setTags={updateTags}
                tagItems={tagItems}
                setTagItems={updateTagItems}
                currentUser={currentUser}
                onLogout={handleLogout}
              />
            </ProtectedRoute>
          }
        />

        <Route
          path="/day/:date"
          element={
            <ProtectedRoute>
              <DayDetailPagecopy
                schedules={schedules}
                setSchedules={updateSchedules}
                tags={tags}
                setTags={updateTags}
                tagItems={tagItems}
                setTagItems={updateTagItems}
                currentUser={currentUser}
                onLogout={handleLogout}
              />
            </ProtectedRoute>
          }
        />

        <Route
          path="/monthly-plan"
          element={
            <ProtectedRoute>
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
              />
            </ProtectedRoute>
          }
        />
      </Routes>
    </Router>
  );
}

export default Appcopy;
