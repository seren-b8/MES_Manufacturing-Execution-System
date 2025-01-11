import React, { useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import styles from './Login.module.css';  // นำเข้า CSS Module

const Login = () => {
  const [userNo, setUserNo] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleLogin = async () => {
    try {
      const response = await axios.post('http://172.16.1.133:8088/wh-b8/api/login.php', {
        user_no: userNo
      });

      if (response.data) {
        const { token, expire, user } = response.data;

        if (token && expire && user) {
          localStorage.setItem('token', token);
          localStorage.setItem('expire', expire);
          localStorage.setItem('user', JSON.stringify(user));

          navigate('/MainPage');
        } else {
          setError('Invalid data received from the server.');
        }
      }
    } catch (error) {
      setError('Invalid Employeer ID');
    }
  };

  return (
    <div className={styles.wrapper}>
      <div className={styles.loginContainer}>
        <h2>Login</h2>
        <input
          type="password"
          value={userNo}
          onChange={(e) => setUserNo(e.target.value)}
          // placeholder="Enter Employee ID"
          style={{
            fontSize: '90px', // ขยายขนาดของวงกลม (ตัวอักษรที่ถูกซ่อน)
            height: '50px', // ขยายความสูงของฟิลด์
            padding: '10px'  // เพิ่มพื้นที่ข้างในฟิลด์
          }}
        />
        <button onClick={handleLogin}>Login</button>
        {error && <p className={styles.error}>{error}</p>}
      </div>
    </div>
  );
};

export default Login;
