// import React, { useEffect, useState } from 'react';
// import { useLocation, useNavigate } from 'react-router-dom';
// import axios from 'axios'; 
// import styles from './TackingHisense.module.css'; 

// const TackingHisense = () => {
//   const [data, setData] = useState([]);
//   const [filteredData, setFilteredData] = useState([]); 
//   const [models, setModels] = useState([]);
//   const [selectedModel, setSelectedModel] = useState('');
  
//   const location = useLocation(); 
//   const navigate = useNavigate();

//   useEffect(() => {
//     const token = localStorage.getItem('token');
//     const expire = localStorage.getItem('expire');
//     const now = Math.floor(Date.now() / 1000); 

//     if (!token || now > expire) {
//       navigate('/login');
//     }
//   }, [navigate]);

//   useEffect(() => {
//     const fetchData = async (customer, partCode, date) => {
//       try {
//         const response = await axios.post('http://172.16.1.133:8088/wh-b8/api/tackingHisense.php', {
//           customer: customer,
//           part_code: partCode,  // Use part_code instead of part_name
//           start_date: date,
//           end_date: date
//         });
  
//         if (response.data.success) {
//           console.log(response.data.data);
//           const filteredData = response.data.data.filter(item => item.part_code === partCode); // Filter by part_code
//           setData(filteredData);
//           setFilteredData(filteredData);
//           extractUniqueModels(filteredData);
//         } else {
//           alert('Error fetching data');
//         }
//       } catch (error) {
//         console.error('There was an error fetching data:', error);
//       }
//     };
  
//     if (location.state && location.state.customer && location.state.part && location.state.date) {
//       const customer = location.state.customer;
//       const partCode = location.state.part;  // Retrieve part_code from location state
//       const date = location.state.date;
//       fetchData(customer, partCode, date);  // Use partCode for fetching data
//     }
//   }, [location.state]);

//   const extractUniqueModels = (data) => {
//     const uniqueModels = [...new Set(data.map(item => item.model))];
//     setModels(uniqueModels);
//   };

//   const handleModelChange = (event) => {
//     const selectedModel = event.target.value;
//     setSelectedModel(selectedModel);

//     if (selectedModel === '') {
//       setFilteredData(data);
//     } else {
//       const filtered = data.filter(row => row.model === selectedModel);
//       setFilteredData(filtered);
//     }
//   };

//   const calculateLabelTarget = (labelTarget) => {
//     const factor = location.state?.factor || 1; 
//     return Math.ceil((labelTarget / factor)); 
//   };

//   const handlePrintLabel = (row) => {
//     const user = JSON.parse(localStorage.getItem('user'));
//     const machineNo = location.state?.machineNo;
//     navigate('/generateLabels', {
//       state: {
//         formData: {
//           jobOrder: row.job_order,
//           customerName: row.customer, 
//           supplier: 'SNC SERENITY CO.,LTD',
//           partCode: row.part_code,
//           mat: row.material,
//           color: row.color,
//           model: row.model,
//           partName: row.part_name,
//           quantity: row.target,
//           quantityStd: row.quantity_std,
//           matNo: row.mat_no ,
//           shift: location.state.shift,
//           line: location.state.line,
//           machineNo: machineNo,
//           labelTarget: calculateLabelTarget(row.label_target),
//           username: user ? user.name : '',
//         }
//       }
//     });
//   };

//   const formatThaiDate = (isoDate) => {
//     if (!isoDate) return '';
//     const date = new Date(isoDate);
//     const day = date.getDate().toString().padStart(2, '0');
//     const month = (date.getMonth() + 1).toString().padStart(2, '0');
//     const year = date.getFullYear() + 543;
//     return `${day}/${month}/${year}`;
//   };

//   return (
//     <div className={styles.container}>
//       <h2 className={styles.heading}>Plan Order Date : {formatThaiDate(location.state?.date)}</h2>

//       <div className={styles.formGroup}>
//         <label className={styles.label}>Select Model</label>
//         <select value={selectedModel} onChange={handleModelChange} className={styles.select} style={{width:'325px'}}>
//           <option value="">All Models</option>
//           {models.map((model, index) => (
//             <option key={index} value={model}>{model}</option>
//           ))}
//         </select>
//       </div>

      // <table className={styles.table}>
      //   <thead>
      //     <tr>
      //       <th>ใบสั่งงาน</th>
      //       <th>เลขวัสดุ</th>
      //       <th>รหัสชิ้นงาน</th>
      //       <th>ชื่อชิ้นงาน</th>
      //       <th>รุ่น</th>
      //       <th>สี</th>
      //       <th>เป้าหมาย</th>
      //       <th>จำนวนมาตรฐาน</th>
      //       <th>ลูกค้า</th>
      //       <th>วัสดุ</th>
      //       <th>จำนวนเบิก/กะ</th>
      //       <th>ดูฉลาก</th>
      //     </tr>
      //   </thead>
      //   <tbody>
      //     {filteredData.length > 0 ? (
      //       filteredData.map((row, index) => (
      //         <tr key={index}>
      //           <td>{row.job_order}</td>
      //           <td>{row.mat_no}</td>
      //           <td>{row.part_code}</td>
      //           <td>{row.part_name}</td>
      //           <td>{row.model}</td>
      //           <td>{row.color}</td>
      //           <td>{row.target}</td>
      //           <td>{row.quantity_std}</td>
      //           <td>{row.customer}</td>
      //           <td>{row.material}</td>
      //           <td>{calculateLabelTarget(row.label_target)}</td>
      //           <td>
      //             <button className={styles.button} onClick={() => handlePrintLabel(row)}>View</button>
      //           </td>
      //         </tr>
      //       ))
      //     ) : (
      //       <tr>
      //         <td colSpan="12" style={{ textAlign: 'center' }}>ไม่มีข้อมูล</td>
      //       </tr>
      //     )}
      //   </tbody>
      // </table>
//     </div>
//   );
// };

// export default TackingHisense;

import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import axios from 'axios';
import styles from './TackingHisense.module.css';

const TackingHisense = () => {
  const [data, setData] = useState([]);
  const [filteredData, setFilteredData] = useState([]);
  const [models, setModels] = useState([]);
  const [selectedModel, setSelectedModel] = useState('');

  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const token = localStorage.getItem('token');
    const expire = localStorage.getItem('expire');
    const now = Math.floor(Date.now() / 1000);

    if (!token || now > expire) {
      navigate('/login');
    }
  }, [navigate]);

  useEffect(() => {
    const fetchData = async (customer, partCode, date) => {
      try {
        const response = await axios.post(
          'http://172.16.1.133:8088/wh-b8/api/tackingHisense.php',
          {
            customer: customer,
            part_code: partCode,
            start_date: date,
            end_date: date,
          }
        );

        if (response.data.success) {
          const filteredData = response.data.data.filter(
            (item) => item.part_code === partCode
          );
          setData(filteredData);
          setFilteredData(filteredData);
          extractUniqueModels(filteredData);
        } else {
          alert('Error fetching data');
        }
      } catch (error) {
        console.error('There was an error fetching data:', error);
      }
    };

    if (location.state?.customer && location.state?.part && location.state?.date) {
      const { customer, part: partCode, date } = location.state;
      fetchData(customer, partCode, date);
    }
  }, [location.state]);

  const extractUniqueModels = (data) => {
    const uniqueModels = [...new Set(data.map((item) => item.model))];
    setModels(uniqueModels);
  };

  const handleModelChange = (event) => {
    const selectedModel = event.target.value;
    setSelectedModel(selectedModel);
    setFilteredData(
      selectedModel === '' ? data : data.filter((row) => row.model === selectedModel)
    );
  };

  const calculateLabelTarget = (labelTarget) => {
    const factor = location.state?.factor || 1;
    return Math.ceil(labelTarget / factor);
  };

  const handlePrintLabel = (row) => {
    const user = JSON.parse(localStorage.getItem('user'));
    const machineNo = location.state?.machineNo;
    navigate('/generateLabels', {
      state: {
        formData: {
          jobOrder: row.job_order,
          customerName: row.customer,
          supplier: 'SNC SERENITY CO.,LTD',
          partCode: row.part_code,
          mat: row.material,
          color: row.color,
          model: row.model,
          partName: row.part_name,
          quantity: row.target,
          quantityStd: row.quantity_std,
          matNo: row.mat_no,
          shift: location.state.shift,
          line: location.state.line,
          machineNo: machineNo,
          labelTarget: calculateLabelTarget(row.label_target),
          username: user ? user.name : '',
        },
      },
    });
  };

  const formatThaiDate = (isoDate) => {
    if (!isoDate) return '';
    const date = new Date(isoDate);
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear() + 543;
    return `${day}/${month}/${year}`;
  };

  return (
    <div className={styles.container}>
      <h2 className={styles.heading}>
        Plan Order Date: {formatThaiDate(location.state?.date)}
      </h2>

      <div className={styles.formGroup}>
        <label className={styles.label}>Select Model</label>
        <select
          value={selectedModel}
          onChange={handleModelChange}
          className={styles.select}
          style={{ width: '325px' }}
        >
          <option value="">All Models</option>
          {models.map((model, index) => (
            <option key={index} value={model}>
              {model}
            </option>
          ))}
        </select>
      </div>

      <table className={styles.table}>
        <thead>
          <tr>
            <th>ใบสั่งงาน</th>
            <th>เลขวัสดุ</th>
            <th>รหัสชิ้นงาน</th>
            <th>ชื่อชิ้นงาน</th>
            <th>รุ่น</th>
            <th>สี</th>
            <th>เป้าหมาย</th>
            <th>จำนวนมาตรฐาน</th>
            <th>ลูกค้า</th>
            <th>วัสดุ</th>
            <th>จำนวนเบิก/กะ</th>
            <th>ดูฉลาก</th>
          </tr>
        </thead>
        <tbody>
          {filteredData.length > 0 ? (
            filteredData.map((row, index) => (
              <tr key={index}>
                <td>{row.job_order}</td>
                <td>{row.mat_no}</td>
                <td>{row.part_code}</td>
                <td>{row.part_name}</td>
                <td>{row.model}</td>
                <td>{row.color}</td>
                <td>{row.target}</td>
                <td>{row.quantity_std}</td>
                <td>{row.customer}</td>
                <td>{row.material}</td>
                <td>{calculateLabelTarget(row.label_target)}</td>
                <td>
                  <button className={styles.button} onClick={() => handlePrintLabel(row)}>View</button>
                </td>
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan="12" style={{ textAlign: 'center' }}>ไม่มีข้อมูล</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
};

export default TackingHisense;
