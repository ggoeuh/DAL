// Appcopy.jsx - 긴급 수정: 무한루프 완전 해결, 서버 에러 처리
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

  // 🔧 중복 저장 방지용 플래그들
  const isSavingRef = useRef(false);
  const saveTimeoutRef = useRef(null);
  const lastSaveDataRef = useRef('');

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
    if (!currentUser || isLoading || isSavingRef.current) return;

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
    if (!currentUser) return false;

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

  // 사용자 데이터 로드 함수
  const loadCurrentUserData = async (nickname) => {
    if (!nickname) return;
    
    try {
      setIsLoading(true);
      console.log('📦 사용자 데이터 로딩 시작:', nickname);
      
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
      
      console.log('✅ 사용자 데이터 로딩 완료:', {
        nickname,
        schedulesCount: userData.schedules?.length || 0,
        tagsCount: userData.tags?.length || 0,
        tagItemsCount: userData.tagItems?.length || 0,
        monthlyPlansCount: userData.monthlyPlans?.length || 0,
        monthlyGoalsCount: userData.monthlyGoals?.length || 0
      });
      
    } catch (error) {
      console.error('❌ 사용자 데이터 로딩 실패:', error);
      
      setSchedules([]);
      setTags([]);
      setTagItems([]);
      setMonthlyPlans([]);
      setMonthlyGoals([]);
      
    } finally {
      setIsLoading(false);
    }
  };

  // 컴포넌트 마운트 시 로그인 상태 확인
  useEffect(() => {
    const checkLoginStatus = async () => {
      const nickname = localStorage.getItem('nickname');
      if (nickname) {
        setIsLoggedIn(true);
        setCurrentUser(nickname);
        await loadCurrentUserData(nickname);
      } else {
        setIsLoading(false);
      }
    };
    checkLoginStatus();
  }, []);

  // 🔧 최종 안전한 자동 저장 (1초 디바운싱)
  useEffect(() => {
    if (!currentUser || isLoading) return;

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
  }, [schedules, tags, tagItems, monthlyPlans, monthlyGoals, currentUser, isLoading]);

  // 🔧 상태 업데이트 함수들 (즉시 로컬 저장만)
  const updateSchedules = (newSchedules) => {
    setSchedules(newSchedules);
    // 즉시 로컬 저장만 (서버는 useEffect에서)
    if (currentUser) {
      saveSchedulesToStorage(currentUser, newSchedules);
      console.log('💾 일정 즉시 로컬 저장:', newSchedules.length, '개');
    }
  };

  const updateTags = (newTags) => {
    setTags(newTags);
    if (currentUser) {
      saveTagsToStorage(currentUser, newTags);
      console.log('💾 태그 즉시 로컬 저장:', newTags.length, '개');
    }
  };

  const updateTagItems = (newTagItems) => {
    setTagItems(newTagItems);
    if (currentUser) {
      saveTagItemsToStorage(currentUser, newTagItems);
      console.log('💾 태그아이템 즉시 로컬 저장:', newTagItems.length, '개');
    }
  };

  const updateMonthlyPlans = (newPlans) => {
    setMonthlyPlans(newPlans);
    if (currentUser) {
      saveMonthlyPlansToStorage(currentUser, newPlans);
      console.log('💾 월간계획 즉시 로컬 저장:', newPlans.length, '개');
    }
  };

  const updateMonthlyGoals = (newGoals) => {
    setMonthlyGoals(newGoals);
    if (currentUser) {
      saveMonthlyGoalsToStorage(currentUser, newGoals);
      console.log('💾 월간목표 즉시 로컬 저장:', newGoals.length, '개');
    }
  };

  // 로그아웃 함수
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
    
    // 플래그 초기화
    isSavingRef.current = false;
    lastSaveDataRef.current = '';
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

  // 로딩 화면
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-600">데이터를 불러오는 중...</p>
          <p className="text-sm text-gray-500 mt-2">로컬 데이터를 우선 로드합니다...</p>
        </div>
      </div>
    );
  }

  return (
    <Router>
      <Routes>
        <Route path="/login" element={<LogInPage />} />
        
        <Route
          path="/"
          element={
            isLoggedIn ? (
              (currentUser === 'admin' || currentUser === '관리자') ?
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
