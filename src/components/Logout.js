// import React from 'react';
// import { useNavigate } from 'react-router-dom';
// import { TbLogout } from "react-icons/tb";

// const Logout = () => {
//   const navigate = useNavigate();

//   const handleLogout = () => {
//     // ลบ token, expire, และข้อมูล user ออกจาก localStorage
//     localStorage.removeItem('token');
//     localStorage.removeItem('expire');
//     localStorage.removeItem('user');

//     // นำไปยังหน้าล็อกอิน
//     navigate('/login'); // เปลี่ยนเส้นทางไปหน้าล็อกอินหรือหน้าที่คุณต้องการ
//   };

//   return (
//     <TbLogout
//       onClick={handleLogout} 
//       style={{ marginLeft: '5px', padding: '5px', cursor: 'pointer' }}
//       size={30} 
//     />
//   );
// };

// export default Logout;

import React, { useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { TbLogout } from "react-icons/tb";

const Logout = () => {
  const navigate = useNavigate();

  // Define handleLogout with useCallback so it doesn't recreate on every render
  const handleLogout = useCallback(() => {
    // Remove token, expire, and user information from localStorage
    localStorage.removeItem('token');
    localStorage.removeItem('expire');
    localStorage.removeItem('user');
    navigate('/login');
  }, [navigate]);

  // Auto-logout after 15 minutes (900,000 milliseconds)
  useEffect(() => {
    const expireTime = localStorage.getItem('expire');
    const now = Math.floor(Date.now() / 1000);

    if (expireTime && now > expireTime) {
      handleLogout();
    } else {
      const remainingTime = expireTime ? (expireTime - now) * 1000 : 86400000;
      const timer = setTimeout(handleLogout, remainingTime); // Auto logout after remaining time

      return () => clearTimeout(timer); // Clear the timer when the component unmounts or when time resets
    }
  }, [handleLogout]); // Add handleLogout to the dependency array

  return (
    <TbLogout
      onClick={handleLogout}
      style={{ marginLeft: '5px', padding: '5px', cursor: 'pointer' }}
      size={30}
    />
  );
};

export default Logout;
