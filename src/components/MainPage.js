import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import styles from './MainPage.module.css'; // นำเข้าไฟล์ CSS แบบโมดูล

const MainPage = () => {
  const [shift, setShift] = useState('');
  const [line, setLine] = useState(''); // เปลี่ยนค่าเริ่มต้นเป็นว่าง
  const [customer, setCustomer] = useState(''); // เปลี่ยนค่าเริ่มต้นเป็นว่าง
  const [parts, setParts] = useState([]);  // สำหรับเก็บข้อมูล parts จาก API
  const [error, setError] = useState('');
  const [formData, setFormData] = useState({
    date: '',
    part: '',
    machineNo: ''
  });

  const navigate = useNavigate();

  // ดึงข้อมูล parts จาก API เมื่อ component ถูก mount
  useEffect(() => {
    const fetchParts = async () => {
      try {
        const response = await axios.get('http://172.16.1.133:8088/wh-b8/api/getParts.php');
        if (response.data.success) {
          setParts(response.data.parts);
        } else {
          setError('Error fetching parts');
        }
      } catch (error) {
        setError('Failed to fetch parts');
      }
    };

    fetchParts();
  }, []);

  // ตรวจสอบการยืนยัน token ทุกครั้งที่โหลดหน้า
  useEffect(() => {
    const token = localStorage.getItem('token');
    const expire = localStorage.getItem('expire');
    const now = Math.floor(Date.now() / 1000);

    if (!token || now > expire) {
      navigate('/login');
    }
  }, [navigate]);

  // ฟังก์ชันตรวจสอบและส่งข้อมูลเมื่อคลิกปุ่ม Submit
  const handleSubmit = useCallback(() => {
    const shiftValue = 2; // ส่งค่า 2 ไม่ว่าจะเป็น Day Shift หรือ Night Shift

    // console.log('Shift:', shift);
    // console.log('Line:', line);
    // console.log('Date:', formData.date);
    // console.log('Part:', formData.part);
    // console.log('Machine No:', formData.machineNo);

    if (!shift || !line || !formData.date || !formData.part || !formData.machineNo) {
      setError('Please fill in all fields.');
      return;
    } else {
      setError('');

      // นำทางไปยังหน้า /TackingHisense พร้อมส่งข้อมูล state
      navigate('/TackingHisenseAuto', { 
        state: { 
          customer: customer, 
          part: formData.part,
          factor: shiftValue,
          shift: shift,  
          line: line,
          machineNo: formData.machineNo,
          date: formData.date  // ส่งวันที่ไปด้วย

        } 
      });
    }
  }, [customer, shift, line, formData, navigate]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prevState => ({ ...prevState, [name]: value }));
  };

  return (
    <div className={styles.wrapper}>
      <div className={styles.card}>
        <label style={{textAlign:'center', marginBottom: '5px', fontWeight: 'bold', fontSize: '24px' }}>แบบฟอร์มเบิก TAG ติดชิ้นงาน</label>
        <div className={styles.formGroup}>
          <label className={styles.label}>Select Customer :</label>
          <select value={customer} onChange={(e) => setCustomer(e.target.value)} className={styles.select} style={{width:'532px'}}>
            <option value="">-- Select Customer --</option> {/* ค่าเริ่มต้นเป็นว่าง */}
            <option value="HISENSE">HISENSE</option>
          </select>
        </div>

        <div className={styles.formGroup}>
          <label className={styles.label}>Select Shift :</label>
          <select value={shift} onChange={(e) => setShift(e.target.value)} className={styles.select} style={{width:'532px'}}>
            <option value="">-- Select Shift --</option> {/* ค่าเริ่มต้นเป็นว่าง */}
            <option value="Day Shift">Day Shift</option>
            <option value="Night Shift">Night Shift</option>
          </select>
        </div>

        <div className={styles.formGroup}>
          <label className={styles.label}>Select Line :</label>
          <select value={line} onChange={(e) => setLine(e.target.value)} className={styles.select} style={{width:'532px'}}>
            <option value="">-- Select Line --</option> {/* ค่าเริ่มต้นเป็นว่าง */}
            <option value="Line A">Line A</option>
            <option value="Line B1">Line B1</option>
            <option value="Line B2">Line B2</option>
          </select>
        </div>

        {/* กรอกข้อมูลตามคอลัมน์ในตาราง */}
        <div className={styles.formGroup}>
          <label className={styles.label}>วันที่ :</label>
          <input type="date" name="date" value={formData.date} onChange={handleInputChange} className={styles.input} style={{width:'532px'}} />
        </div>

        <div className={styles.formGroup}>
          <label className={styles.label}>Part :</label>
          <select name="part" value={formData.part} onChange={handleInputChange} className={styles.select} style={{width:'532px'}}>
            <option value="">-- Select Part --</option>
            {parts.map((part, index) => (
              <option key={index} value={part.part_code}>{part.part_code}</option>
            ))}
          </select>
        </div>

        <div className={styles.formGroup}>
          <label className={styles.label}>No. Machine :</label>
          <input type="text" name="machineNo" value={formData.machineNo} onChange={handleInputChange} className={styles.input} style={{width:'532px'}}/>
        </div>

        {error && <p className={styles.error}>{error}</p>}

        <button onClick={handleSubmit} className={styles.button}>เบิก TAG</button>
      </div>
    </div>
  );
};

export default MainPage;
