// Appcopy.jsx - 무한 루프 해결, 안전한 저장 버전
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

  // ✨ DAL 관련 상태들
  const [dalSubscription, setDalSubscription] = useState(null);
  
  // 🔧 무한 루프 방지용 레퍼런스
  const isSavingRef = useRef(false);
  const lastSaveTimeRef = useRef(0);
  const saveTimeoutRef = useRef(null);

  // DAL 활동 로그 저장 함수 (throttled)
  const logDalActivity = async (activityType, description, duration = null) => {
    if (!currentUser) return;

    try {
      // Supabase 스크립트 로드 확인
      if (!document.head.querySelector('script[src*="supabase"]')) {
        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';
        document.head.appendChild(script);
      }

      setTimeout(async () => {
        try {
          const supabase = window.supabase?.createClient(
            'https://hbrnjzclvtreppxzsspv.supabase.co',
            'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhicm5qemNsdnRyZXBweHpzc3B2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDk3NjY5OTgsImV4cCI6MjA2NTM0Mjk5OH0.txgsa7O_kzdeI2RjM1CEiIW6Zt419gr0o2BgULdTcQc'
          );

          if (supabase) {
            const { error } = await supabase.from('DAL').insert([{
              user_name: currentUser,
              activity_type: activityType,
              description: description,
              duration: duration,
              completed: true
            }]);

            if (!error) {
              console.log('✅ DAL 활동 로그 저장 성공:', { activityType, description });
            } else {
              console.warn('⚠️ DAL 로그 저장 실패:', error);
            }
          }
        } catch (error) {
          console.warn('⚠️ DAL 로그 저장 실패 (무시):', error);
        }
      }, 1000);
    } catch (error) {
      console.warn('⚠️ DAL 활동 로그 실패 (계속 진행):', error);
    }
  };

  // 🔧 안전한 저장 함수 (중복 실행 방지)
  const safelySaveData = async (immediate = false) => {
    if (!currentUser || isLoading) return;
    
    // 이미 저장 중이면 중단
    if (isSavingRef.current) {
      console.log('⚠️ 이미 저장 중 - 스킵');
      return;
    }

    // 너무 자주 저장하는 것 방지 (최소 500ms 간격)
    const now = Date.now();
    if (!immediate && (now - lastSaveTimeRef.current) < 500) {
      console.log('⚠️ 저장 간격 너무 짧음 - 스킵');
      return;
    }

    isSavingRef.current = true;
    lastSaveTimeRef.current = now;

    try {
      // 로컬 저장 (즉시)
      saveSchedulesToStorage(currentUser, schedules);
      saveTagsToStorage(currentUser, tags);
      saveTagItemsToStorage(currentUser, tagItems);
      saveMonthlyPlansToStorage(currentUser, monthlyPlans);
      saveMonthlyGoalsToStorage(currentUser, monthlyGoals);
      
      console.log('💾 로컬 저장 완료:', currentUser);

      // 서버 저장 (백그라운드, 에러 무시)
      try {
        await saveUserCoreData(currentUser, {
          schedules, tags, tagItems, monthlyPlans, monthlyGoals
        });
        console.log('🌐 서버 저장 완료:', currentUser);
      } catch (serverError) {
        console.warn('⚠️ 서버 저장 실패 (로컬은 저장됨):', serverError);
      }

    } catch (error) {
      console.error('❌ 저장 실패:', error);
    } finally {
      isSavingRef.current = false;
    }
  };

  // 실시간 DAL 구독 설정
  const setupDalSubscription = () => {
    if (!currentUser || dalSubscription) return;

    try {
      setTimeout(() => {
        if (window.supabase && !dalSubscription) {
          const supabase = window.supabase.createClient(
            'https://hbrnjzclvtreppxzsspv.supabase.co',
            'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhicm5qemNsdnRyZXBweHpzc3B2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDk3NjY5OTgsImV4cCI6MjA2NTM0Mjk5OH0.txgsa7O_kzdeI2RjM1CEiIW6Zt419gr0o2BgULdTcQc'
          );

          const subscription = supabase
            .channel(`dal_${currentUser}`)
            .on('postgres_changes', 
              { 
                event: '*', 
                schema: 'public', 
                table: 'DAL',
                filter: `user_name=eq.${currentUser}`
              }, 
              (payload) => {
                console.log('🔄 DAL 실시간 변화 감지:', payload);
              }
            )
            .subscribe();

          setDalSubscription(subscription);
          console.log('🔄 DAL 실시간 구독 시작:', currentUser);
        }
      }, 3000);
    } catch (error) {
      console.warn('⚠️ DAL 구독 설정 실패:', error);
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
      await safelyServerSave(true); // 강제 저장
      await logDalActivity('sync', '수동 서버 동기화 완료');
      alert('✅ 서버 동기화가 완료되었습니다!');
      return true;
    } catch (error) {
      console.error('❌ 수동 서버 동기화 실패:', error);
      await logDalActivity('error', '서버 동기화 실패');
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
            { tagType: '수업', color: { bg: 'bg-blue-100', text: 'text-blue-800' } },
            { tagType: '개인', color: { bg: 'bg-green-100', text: 'text-green-800' } },
            { tagType: 'Lab', color: { bg: 'bg-purple-100', text: 'text-purple-800' } },
            { tagType: '연구', color: { bg: 'bg-red-100', text: 'text-red-800' } }
          ],
          tagItems: [
            { tagType: '수업', tagName: '과제' },
            { tagType: '개인', tagName: '운동' },
            { tagType: 'Lab', tagName: '업무' },
            { tagType: '연구', tagName: '회의' },
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
        
        // DAL 구독 설정
        setupDalSubscription();
        
        // 로그인 활동 로그
        setTimeout(() => {
          logDalActivity('login', '사용자 로그인');
        }, 2000);
      } else {
        setIsLoading(false);
      }
    };
    checkLoginStatus();
  }, []);

  // 🔧 안전한 자동 저장 (디바운싱 포함)
  useEffect(() => {
    if (!currentUser || isLoading) return;
    
    // 기존 타이머 취소
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    
    // 500ms 디바운싱으로 과도한 저장 방지
    saveTimeoutRef.current = setTimeout(() => {
      safelyServerSave();
    }, 500);
    
    // 클린업
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [schedules, tags, tagItems, monthlyPlans, monthlyGoals, currentUser, isLoading]);

  // 🔧 개선된 상태 업데이트 함수들 (즉시 로컬 저장 + DAL 로그)
  const updateSchedules = (newSchedules) => {
    const oldCount = schedules.length;
    const newCount = newSchedules.length;
    
    setSchedules(newSchedules);
    
    // 즉시 로컬 저장 (서버 저장은 useEffect에서)
    if (currentUser) {
      saveSchedulesToStorage(currentUser, newSchedules);
      
      // 변화가 있을 때만 로그
      if (oldCount !== newCount) {
        const action = newCount > oldCount ? '추가' : '삭제';
        logDalActivity('schedule', `일정 ${action}: ${Math.abs(newCount - oldCount)}개`);
      }
    }
  };

  const updateTags = (newTags) => {
    setTags(newTags);
    if (currentUser) {
      saveTagsToStorage(currentUser, newTags);
      logDalActivity('tag', `태그 업데이트: ${newTags.length}개`);
    }
  };

  const updateTagItems = (newTagItems) => {
    setTagItems(newTagItems);
    if (currentUser) {
      saveTagItemsToStorage(currentUser, newTagItems);
      logDalActivity('tag_item', `태그 아이템 업데이트: ${newTagItems.length}개`);
    }
  };

  const updateMonthlyPlans = (newPlans) => {
    setMonthlyPlans(newPlans);
    if (currentUser) {
      saveMonthlyPlansToStorage(currentUser, newPlans);
      logDalActivity('monthly_plan', `월간 계획 업데이트: ${newPlans.length}개`);
    }
  };

  const updateMonthlyGoals = (newGoals) => {
    setMonthlyGoals(newGoals);
    if (currentUser) {
      saveMonthlyGoalsToStorage(currentUser, newGoals);
      logDalActivity('monthly_goal', `월간 목표 업데이트: ${newGoals.length}개`);
    }
  };

  // 로그아웃 함수
  const handleLogout = async () => {
    if (currentUser) {
      await logDalActivity('logout', '사용자 로그아웃');
      
      // DAL 구독 해제
      if (dalSubscription) {
        dalSubscription.unsubscribe();
        setDalSubscription(null);
        console.log('🔄 DAL 구독 해제됨');
      }
    }
    
    localStorage.removeItem('nickname');
    setIsLoggedIn(false);
    setCurrentUser('');
    setSchedules([]);
    setTags([]);
    setTagItems([]);
    setMonthlyPlans([]);
    setMonthlyGoals([]);
  };

  const handleAdminLogout = () => {
    handleLogout();
  };

  // 컴포넌트 언마운트 시 정리
  useEffect(() => {
    return () => {
      if (dalSubscription) {
        dalSubscription.unsubscribe();
      }
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [dalSubscription]);

  // 로딩 화면
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-600">데이터를 불러오는 중...</p>
          <p className="text-sm text-gray-500 mt-2">서버에서 최신 데이터를 확인하고 있습니다...</p>
          <p className="text-xs text-blue-500 mt-1">실시간 활동 로그 준비 중...</p>
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
