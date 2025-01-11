import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import styles from './ReportIssueTag.module.css'; // Import CSS Module

const ReportIssueTag = () => {
  const [startDate, setStartDate] = useState(''); // Start Date
  const [endDate, setEndDate] = useState(''); // End Date
  const [reportData, setReportData] = useState([]); // Report Data
  // const [errorMessage, setErrorMessage] = useState(''); // Error Message

  const navigate = useNavigate();

  // Check token validity on page load
  useEffect(() => {
    const token = localStorage.getItem('token');
    const expire = localStorage.getItem('expire');
    const now = Math.floor(Date.now() / 1000);

    if (!token || now > expire) {
      navigate('/login');
    }
  }, [navigate]);

  // Fetch report data based on date range
  useEffect(() => {
    const fetchReport = async () => {
      if (startDate && endDate) {
        try {
          const response = await axios.post('http://172.16.1.133:8088/wh-b8/api/getIssueTagReport.php', {
            startDate: startDate, // Send start date
            endDate: endDate, // Send end date
          });

          if (response.data.status === 'success') {
            setReportData(response.data.data);
            // setErrorMessage(''); // Clear error message
          } else {
            console.log('No data found for the selected date range.')
            // setErrorMessage('No data found for the selected date range.');
          }
        } catch (error) {
          console.error('Error fetching report data:', error);
          // setErrorMessage('Error fetching report data. Please try again later.');
        }
      }
    };

    fetchReport(); // Fetch report when date changes
  }, [startDate, endDate]); // Trigger on startDate or endDate changes

  return (
    <div className={styles['report-container']}>
      <h1>Report Issue Tag</h1>
      <div className={styles['date-picker-group']}>
        <div className={styles['form-group']}>
          <label style={{ width: '40%' }}>Select Date:</label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className={styles['date-picker']}
          />
        </div>
        <div className={styles['form-group']}>
          <label style={{ width: '15%' }}>TO</label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className={styles['date-picker']}
          />
        </div>
      </div>

      {/* {errorMessage && <p className={styles['error-message']}>{errorMessage}</p>} */}

      {reportData.length > 0 ? (
        <table className={styles['report-table']}>
          <thead>
            <tr>
              <th style={{textAlign: 'center'}}>ลำดับ</th>
              <th style={{textAlign: 'center'}}>ชื่อผู้เบิก</th>
              <th style={{textAlign: 'center'}}>กะ</th>
              <th style={{textAlign: 'center'}}>ไลน์</th>
              <th style={{textAlign: 'center'}}>ชื่องาน</th>
              <th style={{textAlign: 'center'}}>หมายเลขเครื่อง</th>
              <th style={{textAlign: 'center'}}>จำนวน/กะ</th>
              <th style={{textAlign: 'center'}}>วันที่เบิก</th>
            </tr>
          </thead>
          <tbody>
            {reportData.map((row, index) => (
              <tr key={index}>
                <td style={{textAlign: 'center'}}>{index + 1}</td>
                <td style={{textAlign: 'center'}}>{row.username}</td>
                <td style={{textAlign: 'center'}}>{row.shift}</td>
                <td style={{textAlign: 'center'}}>{row.line}</td>
                <td style={{textAlign: 'center'}}>{row.part_name}</td>
                <td style={{textAlign: 'center'}}>{row.machine_no}</td>
                <td style={{textAlign: 'center'}}>{row.label_target}</td>
                <td style={{textAlign: 'center'}}>{new Date(row.created_at).toLocaleDateString('th-TH', { day: '2-digit', month: '2-digit', year: 'numeric' })}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <table className={styles['report-table']}>
          <tbody>
            <tr>
              <td colSpan="8" style={{ textAlign: 'center' }}>ไม่มีข้อมูล</td>
            </tr>
          </tbody>
        </table>
    )}
    </div>
  );
};

export default ReportIssueTag;
