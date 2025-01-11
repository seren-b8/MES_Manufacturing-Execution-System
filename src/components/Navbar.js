import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FaCircleUser } from "react-icons/fa6";
import Logout from './Logout'; // นำเข้า Logout component
import './Navbar.css';

const Navbar = () => {
  const [userName, setUserName] = useState('ADMIN'); // ค่าเริ่มต้นเป็น ADMIN
  const navigate = useNavigate();

  // ฟังก์ชันที่จะดึงชื่อผู้ใช้จาก localStorage
  useEffect(() => {
    const user = JSON.parse(localStorage.getItem('user')); // ดึงข้อมูลผู้ใช้จาก localStorage
    if (user) {
      setUserName(user.name.split(' ')[1]); // ตั้งค่าเฉพาะชื่อ โดยตัดนามสกุลออก
    }
  }, []); // ดึงข้อมูลเมื่อ Component ถูก mount

  const handleFromClick = () => {
    navigate('/MainPage');
  };
  
  const handleimportClick = () => {
    navigate('/importPlan'); 
  };

  const handlereportClick = () => {
    navigate('/report'); 
  };

  const handleDashboardClick = () => {
    navigate('/Dashboard'); 
  };

  return (
    <nav className="navbar">
      <div className="navbar-logo">
        <span onClick={handleFromClick} className="scan-text">SEREN</span>
        <div className="navbar-divider"></div>
        <div className="navbar-title">
          B8-B21 Generate Label <br/>SNC SERENITY COMPANY LIMITED
        </div>
      </div>
      <div className="navbar-import">
        <ul style={{cursor:'pointer', color:'#66e64c', textDecoration: 'underline'}} onClick={handleimportClick}>Import Plan</ul>
        <ul style={{cursor:'pointer', color:'#66e64c', textDecoration: 'underline'}} onClick={handlereportClick}>Report</ul>
        <ul style={{cursor:'pointer', color:'#66e64c', textDecoration: 'underline'}} onClick={handleDashboardClick}>Dashboard</ul>
      </div>
      <div className="import">
        <FaCircleUser className="navbar-iconuser" size={30} />
        {userName}
        <Logout />
      </div>
    </nav>
  );
};

export default Navbar;
