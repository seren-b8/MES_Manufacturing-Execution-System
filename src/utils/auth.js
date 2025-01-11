export const isAuthenticated = () => {
    const token = localStorage.getItem('token');
    const expire = localStorage.getItem('expire');
  
    if (!token || !expire) {
      return false;
    }
  
    const now = Math.floor(Date.now() / 1000); // เวลาปัจจุบันในวินาที
    if (now > expire) {
      // ลบ Token ถ้าหมดอายุ
      localStorage.removeItem('token');
      localStorage.removeItem('expire');
      localStorage.removeItem('user');
      return false;
    }
  
    return true;
  };
  