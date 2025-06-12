// netlify/functions/save_data.js - Netlify Functions용 서버리스 함수

const fs = require('fs').promises;
const path = require('path');

// 안전한 파일명 생성
function getSafeFilename(userId) {
  const encoded = encodeURIComponent(userId);
  const safe = encoded.replace(/[^a-zA-Z0-9_-]/g, '_');
  return `${safe}.json`;
}

// 데이터 검증 및 기본값 보장
function validateData(data) {
  return {
    schedules: Array.isArray(data?.schedules) ? data.schedules : [],
    tags: Array.isArray(data?.tags) ? data.tags : [],
    tagItems: Array.isArray(data?.tagItems) ? data.tagItems : [],
    monthlyPlans: Array.isArray(data?.monthlyPlans) ? data.monthlyPlans : [],
    monthlyGoals: Array.isArray(data?.monthlyGoals) ? data.monthlyGoals : [],
    lastUpdated: new Date().toISOString()
  };
}

exports.handler = async (event, context) => {
  // CORS 헤더 설정
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Content-Type': 'application/json'
  };

  // OPTIONS 요청 처리 (CORS 프리플라이트)
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: ''
    };
  }

  try {
    // URL에서 user_id 파라미터 추출
    const params = new URLSearchParams(event.rawQuery || '');
    const userId = params.get('user_id');
    
    if (!userId) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'user_id parameter is required' })
      };
    }

    const filename = getSafeFilename(userId);
    const dataDir = '/tmp'; // Netlify Functions에서 임시 저장소 사용
    const filepath = path.join(dataDir, filename);

    // POST: 데이터 저장
    if (event.httpMethod === 'POST') {
      let requestData;
      
      try {
        requestData = JSON.parse(event.body || '{}');
      } catch (error) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'Invalid JSON format' })
        };
      }

      // 데이터 검증
      const validatedData = validateData(requestData);
      
      try {
        // 파일 저장
        await fs.writeFile(filepath, JSON.stringify(validatedData, null, 2));
        
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({
            success: true,
            message: 'Data saved successfully',
            timestamp: validatedData.lastUpdated,
            user_id: userId,
            data_count: {
              schedules: validatedData.schedules.length,
              tags: validatedData.tags.length,
              tagItems: validatedData.tagItems.length,
              monthlyPlans: validatedData.monthlyPlans.length,
              monthlyGoals: validatedData.monthlyGoals.length
            }
          })
        };
      } catch (error) {
        console.error('File save error:', error);
        return {
          statusCode: 500,
          headers,
          body: JSON.stringify({ error: 'Failed to save data' })
        };
      }
    }

    // GET: 데이터 불러오기
    else if (event.httpMethod === 'GET') {
      try {
        // 파일 존재 확인
        const data = await fs.readFile(filepath, 'utf8');
        const parsedData = JSON.parse(data);
        
        // 데이터 검증 후 반환
        const validatedData = validateData(parsedData);
        
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify(validatedData)
        };
      } catch (error) {
        // 파일이 없으면 기본 데이터 반환
        if (error.code === 'ENOENT') {
          const defaultData = validateData({});
          return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
              ...defaultData,
              note: 'New user data initialized'
            })
          };
        }
        
        console.error('File read error:', error);
        return {
          statusCode: 500,
          headers,
          body: JSON.stringify({ error: 'Failed to read data' })
        };
      }
    }

    // 지원하지 않는 HTTP 메서드
    else {
      return {
        statusCode: 405,
        headers,
        body: JSON.stringify({ error: 'Method not allowed' })
      };
    }

  } catch (error) {
    console.error('Unexpected error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        error: 'Internal server error',
        message: error.message 
      })
    };
  }
};