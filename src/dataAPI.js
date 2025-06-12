const SERVER_URL = 'http://141.223.62.152/save_data.php';

export const saveData = async (userId, data) => {
  try {
    const response = await fetch(SERVER_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        user_id: userId,
        data: data
      })
    });

    const result = await response.json();
    
    if (!response.ok) {
      throw new Error(result.error || 'Failed to save data');
    }
    
    console.log('데이터 저장 성공:', result);
    return result;
  } catch (error) {
    console.error('데이터 저장 실패:', error);
    throw error;
  }
};

export const loadData = async (userId) => {
  try {
    const response = await fetch(`${SERVER_URL}?user_id=${userId}`);
    
    if (!response.ok) {
      throw new Error('Failed to load data');
    }
    
    const data = await response.json();
    console.log('데이터 불러오기 성공:', data);
    return data;
  } catch (error) {
    console.error('데이터 불러오기 실패:', error);
    throw error;
  }
};