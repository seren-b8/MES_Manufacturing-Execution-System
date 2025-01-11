// import React, { useEffect, useState } from 'react';
// import { useLocation, useNavigate } from 'react-router-dom';
// import axios from 'axios';
// import styles from './TackingHisense.module.css';

// const TackingHisenseAuto = () => {
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
//         const response = await axios.post(
//           'http://172.16.1.133:8088/wh-b8/api/tackingHisense.php',
//           {
//             customer: customer,
//             part_code: partCode,
//             start_date: date,
//             end_date: date,
//           }
//         );

//         if (response.data.success) {
//           const filteredData = response.data.data.filter(
//             (item) => item.part_code === partCode
//           );
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

//     if (location.state?.customer && location.state?.part && location.state?.date) {
//       const { customer, part: partCode, date } = location.state;
//       fetchData(customer, partCode, date);
//     }
//   }, [location.state]);

//   const extractUniqueModels = (data) => {
//     const uniqueModels = [...new Set(data.map((item) => item.model))];
//     setModels(uniqueModels);
//   };

//   const handleModelChange = (event) => {
//     const selectedModel = event.target.value;
//     setSelectedModel(selectedModel);
//     setFilteredData(
//       selectedModel === '' ? data : data.filter((row) => row.model === selectedModel)
//     );
//   };

//   const calculateLabelTarget = (labelTarget) => {
//     const factor = location.state?.factor || 1;
//     return Math.ceil(labelTarget / factor);
//   };

//   const formatThaiDate = (isoDate) => {
//     if (!isoDate) return '';
//     const date = new Date(isoDate);
//     const day = date.getDate().toString().padStart(2, '0');
//     const month = (date.getMonth() + 1).toString().padStart(2, '0');
//     const year = date.getFullYear() + 543;
//     return `${day}/${month}/${year}`;
//   };

//   const handlePrintLabel = (row) => {
//     // Placeholder function for "View" functionality
//     console.log("Viewing label data:", row);
//   };

//   const generateSerialNumber = (previousSerial) => {
//     const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
//     let serialArray = previousSerial.split('');

//     for (let i = serialArray.length - 1; i >= 0; i--) {
//       const index = chars.indexOf(serialArray[i]);
//       if (index === -1) continue;
//       if (index < chars.length - 1) {
//         serialArray[i] = chars[index + 1];
//         return serialArray.join('');
//       } else {
//         serialArray[i] = chars[0];
//       }
//     }

//     return serialArray.join('');
//   };

//   const isSerialExists = async (serial) => {
//     try {
//       const checkResponse = await axios.post(
//         'http://172.16.1.133:8088/wh-b8/api/checkSerialNumbers.php',
//         { serialNumbers: [serial] }
//       );
//       return checkResponse.data.duplicates && checkResponse.data.duplicates.length > 0;
//     } catch (error) {
//       console.error('Error checking serial number:', error);
//       return true;
//     }
//   };

//   const handlePrintAndGenerateSerial = async (row) => {
//     const formData = {
//       jobOrder: row.job_order,
//       customerName: row.customer,
//       supplier: 'SNC SERENITY CO.,LTD',
//       partCode: row.part_code,
//       mat: row.material,
//       color: row.color,
//       model: row.model,
//       partName: row.part_name,
//       quantityStd: row.quantity_std,
//       matNo: row.mat_no,
//     };

//     let previousSerial = 'AAAAAA';
//     let newSerialNumbers = [];

//     for (let i = 0; i < calculateLabelTarget(row.label_target); i++) {
//       let serial;
//       let isDuplicate = true;

//       while (isDuplicate) {
//         previousSerial = generateSerialNumber(previousSerial);
//         serial = previousSerial;
//         isDuplicate = await isSerialExists(serial);
//       }
//       newSerialNumbers.push(serial);
//     }

//     const currentDate = new Date().toLocaleDateString('en-GB'); // DD/MM/YYYY

//     try {
//       const saveResponse = await axios.post(
//         'http://172.16.1.133:8088/wh-b8/api/generate.php',
//         {
//           serialNumbers: newSerialNumbers,
//           formData: formData,
//           generateDate: currentDate,
//         }
//       );

//       if (saveResponse.data.status === 'success') {
//         console.log('Serial numbers saved successfully');

//         const payload = {
//           form_data: formData,
//           serial_number: newSerialNumbers[newSerialNumbers.length - 1], // Latest unique serial number
//           state: "1",
//         };

//         const printResponse = await axios.post('http://127.0.0.1:5000/printtest', payload);

//         if (printResponse.data.message === "Print job sent successfully") {
//           alert("Print job sent successfully.");
//         } else {
//           alert("Failed to send print job.");
//         }
//       } else {
//         alert('Error saving serial numbers.');
//       }
//     } catch (error) {
//       console.error('Error saving serial numbers or sending print job:', error);
//     }
//   };

//   return (
//     <div className={styles.container}>
//       <h2 className={styles.heading}>
//         Plan Order Date: {formatThaiDate(location.state?.date)}
//       </h2>

//       <div className={styles.formGroup}>
//         <label className={styles.label}>Select Model</label>
//         <select
//           value={selectedModel}
//           onChange={handleModelChange}
//           className={styles.select}
//           style={{ width: '325px' }}
//         >
//           <option value="">All Models</option>
//           {models.map((model, index) => (
//             <option key={index} value={model}>
//               {model}
//             </option>
//           ))}
//         </select>
//       </div>

//       <table className={styles.table}>
//         <thead>
//           <tr>
//             <th>ใบสั่งงาน</th>
//             <th>เลขวัสดุ</th>
//             <th>รหัสชิ้นงาน</th>
//             <th>ชื่อชิ้นงาน</th>
//             <th>รุ่น</th>
//             <th>สี</th>
//             <th>เป้าหมาย</th>
//             <th>จำนวนมาตรฐาน</th>
//             <th>ลูกค้า</th>
//             <th>วัสดุ</th>
//             <th>จำนวนเบิก/กะ</th>
//             <th>ดูฉลาก</th>
//             <th>พิมพ์</th>
//           </tr>
//         </thead>
//         <tbody>
//           {filteredData.length > 0 ? (
//             filteredData.map((row, index) => (
//               <tr key={index}>
//                 <td>{row.job_order}</td>
//                 <td>{row.mat_no}</td>
//                 <td>{row.part_code}</td>
//                 <td>{row.part_name}</td>
//                 <td>{row.model}</td>
//                 <td>{row.color}</td>
//                 <td>{row.target}</td>
//                 <td>{row.quantity_std}</td>
//                 <td>{row.customer}</td>
//                 <td>{row.material}</td>
//                 <td>{calculateLabelTarget(row.label_target)}</td>
//                 <td>
//                   <button className={styles.button} onClick={() => handlePrintLabel(row)}>View</button>
//                 </td>
//                 <td>
//                   <button className={styles.button} onClick={() => handlePrintAndGenerateSerial(row)}>Print</button>
//                 </td>
//               </tr>
//             ))
//           ) : (
//             <tr>
//               <td colSpan="13" style={{ textAlign: 'center' }}>ไม่มีข้อมูล</td>
//             </tr>
//           )}
//         </tbody>
//       </table>
//     </div>
//   );
// };

// export default TackingHisenseAuto;


////////////////////////ส่งรูปไปด้วย/////////////////////////////////////////////////////

// import React, { useEffect, useState } from 'react';
// import { useLocation, useNavigate } from 'react-router-dom';
// import axios from 'axios';
// import styles from './TackingHisense.module.css';

// const TackingHisenseAuto = () => {
//   const [data, setData] = useState([]);
//   const [filteredData, setFilteredData] = useState([]);
//   const [models, setModels] = useState([]);
//   const [selectedModel, setSelectedModel] = useState('');
//   const [loadingMessage, setLoadingMessage] = useState(''); // Loading message state
//   const [isLoading, setIsLoading] = useState(false); // Loading overlay visibility

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
//         const response = await axios.post(
//           'http://172.16.1.133:8088/wh-b8/api/tackingHisense.php',
//           {
//             customer: customer,
//             part_code: partCode,
//             start_date: date,
//             end_date: date,
//           }
//         );

//         if (response.data.success) {
//           const filteredData = response.data.data.filter(
//             (item) => item.part_code === partCode
//           );
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

//     if (location.state?.customer && location.state?.part && location.state?.date) {
//       const { customer, part: partCode, date } = location.state;
//       fetchData(customer, partCode, date);
//     }
//   }, [location.state]);

//   const extractUniqueModels = (data) => {
//     const uniqueModels = [...new Set(data.map((item) => item.model))];
//     setModels(uniqueModels);
//   };

//   const handleModelChange = (event) => {
//     const selectedModel = event.target.value;
//     setSelectedModel(selectedModel);
//     setFilteredData(
//       selectedModel === '' ? data : data.filter((row) => row.model === selectedModel)
//     );
//   };

//   const calculateLabelTarget = (labelTarget) => {
//     const factor = location.state?.factor || 1;
//     return Math.ceil(labelTarget / factor);
//   };

//   const formatThaiDate = (isoDate) => {
//     if (!isoDate) return '';
//     const date = new Date(isoDate);
//     const day = date.getDate().toString().padStart(2, '0');
//     const month = (date.getMonth() + 1).toString().padStart(2, '0');
//     const year = date.getFullYear() + 543;
//     return `${day}/${month}/${year}`;
//   };

//   const handlePrintLabel = (row) => {
//     console.log("Viewing label data:", row);
//   };

//   const generateSerialNumber = (previousSerial) => {
//     const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
//     let serialArray = previousSerial.split('');

//     for (let i = serialArray.length - 1; i >= 0; i--) {
//       const index = chars.indexOf(serialArray[i]);
//       if (index === -1) continue;
//       if (index < chars.length - 1) {
//         serialArray[i] = chars[index + 1];
//         return serialArray.join('');
//       } else {
//         serialArray[i] = chars[0];
//       }
//     }

//     return serialArray.join('');
//   };

//   const isSerialExists = async (serial) => {
//     try {
//       const checkResponse = await axios.post(
//         'http://172.16.1.133:8088/wh-b8/api/checkSerialNumbers.php',
//         { serialNumbers: [serial] }
//       );
//       return checkResponse.data.duplicates && checkResponse.data.duplicates.length > 0;
//     } catch (error) {
//       console.error('Error checking serial number:', error);
//       return true;
//     }
//   };

//   const getImageBase64 = async (matNo) => {
//     try {
//       const response = await axios.get(getImageUrl(matNo), { responseType: 'arraybuffer' });
//       const base64Image = btoa(
//         new Uint8Array(response.data).reduce((data, byte) => data + String.fromCharCode(byte), '')
//       );
//       return `data:image/jpeg;base64,${base64Image}`;
//     } catch (error) {
//       console.error('Error fetching image:', error);
//       return null;
//     }
//   };

//   const getImageUrl = (matNo) => {
//     return `/imagepart/${matNo}.jpg`; // Assuming images are stored in /public/imagepart
//   };

//   const handlePrintAndGenerateSerial = async (row) => {
//     setIsLoading(true);
//     setLoadingMessage('Generating serial numbers...');

//     const formData = {
//       jobOrder: row.job_order || '',
//       customerName: row.customer || '',
//       supplier: 'SNC SERENITY CO.,LTD',
//       partCode: row.part_code || '',
//       mat: row.material || '',
//       color: row.color || '',
//       model: row.model || '',
//       partName: row.part_name || '',
//       quantityStd: row.quantity_std || '',
//       matNo: row.mat_no || '',
//     };

//     if (row.customer === "HISENSE") {
//       formData.customerName += " - SCAN";
//     }

//     let previousSerial = 'AAAAAA';
//     let newSerialNumbers = [];

//     for (let i = 0; i < calculateLabelTarget(row.label_target); i++) {
//       let serial;
//       let isDuplicate = true;

//       while (isDuplicate) {
//         previousSerial = generateSerialNumber(previousSerial);
//         serial = previousSerial;
//         isDuplicate = await isSerialExists(serial);
//       }
//       newSerialNumbers.push(serial);
//     }

//     const currentDate = new Date().toLocaleDateString('en-GB');
//     const latestSerialNumber = newSerialNumbers[newSerialNumbers.length - 1];

//     try {
//       const base64Image = await getImageBase64(row.mat_no);

//       const saveResponse = await axios.post(
//         'http://172.16.1.133:8088/wh-b8/api/generate.php',
//         {
//           serialNumbers: newSerialNumbers,
//           formData: formData,
//           generateDate: currentDate,
//         }
//       );

//       if (saveResponse.data.status === 'success') {
//         setLoadingMessage('Printing in progress...');
//         const payload = {
//           form_data: formData,
//           serial_number: latestSerialNumber,
//           image: base64Image,
//           state: "1",
//         };

//         const printResponse = await axios.post('http://127.0.0.1:5000/printtest', payload);

//         if (printResponse.data.message === "Print job sent successfully") {
//           alert("Print job sent successfully.");
//         } else {
//           alert("Failed to send print job.");
//         }
//       } else {
//         alert('Error saving serial numbers.');
//       }
//     } catch (error) {
//       console.error('Error saving serial numbers or sending print job:', error);
//     } finally {
//       setIsLoading(false);
//       setLoadingMessage('');
//     }
//   };

//   return (
//     <div className={styles.container}>
//       {isLoading && (
//         <div className={styles.loadingOverlay}>
//           <div className={styles.loadingPopup}>
//             <p>{loadingMessage}</p>
//           </div>
//         </div>
//       )}

//       <h2 className={styles.heading}>
//         Plan Order Date: {formatThaiDate(location.state?.date)}
//       </h2>

//       <div className={styles.formGroup}>
//         <label className={styles.label}>Select Model</label>
//         <select
//           value={selectedModel}
//           onChange={handleModelChange}
//           className={styles.select}
//           style={{ width: '325px' }}
//         >
//           <option value="">All Models</option>
//           {models.map((model, index) => (
//             <option key={index} value={model}>
//               {model}
//             </option>
//           ))}
//         </select>
//       </div>

//       <table className={styles.table}>
//         <thead>
//           <tr>
//             <th>ใบสั่งงาน</th>
//             <th>เลขวัสดุ</th>
//             <th>รหัสชิ้นงาน</th>
//             <th>ชื่อชิ้นงาน</th>
//             <th>รุ่น</th>
//             <th>สี</th>
//             <th>เป้าหมาย</th>
//             <th>จำนวนมาตรฐาน</th>
//             <th>ลูกค้า</th>
//             <th>วัสดุ</th>
//             <th>จำนวนเบิก/กะ</th>
//             <th>ดูฉลาก</th>
//             <th>พิมพ์</th>
//           </tr>
//         </thead>
//         <tbody>
//           {filteredData.length > 0 ? (
//             filteredData.map((row, index) => (
//               <tr key={index}>
//                 <td>{row.job_order}</td>
//                 <td>{row.mat_no}</td>
//                 <td>{row.part_code}</td>
//                 <td>{row.part_name}</td>
//                 <td>{row.model}</td>
//                 <td>{row.color}</td>
//                 <td>{row.target}</td>
//                 <td>{row.quantity_std}</td>
//                 <td>{row.customer}</td>
//                 <td>{row.material}</td>
//                 <td>{calculateLabelTarget(row.label_target)}</td>
//                 <td>
//                   <button className={styles.button} onClick={() => handlePrintLabel(row)}>View</button>
//                 </td>
//                 <td>
//                   <button className={styles.button} onClick={() => handlePrintAndGenerateSerial(row)}>Print</button>
//                 </td>
//               </tr>
//             ))
//           ) : (
//             <tr>
//               <td colSpan="13" style={{ textAlign: 'center' }}>ไม่มีข้อมูล</td>
//             </tr>
//           )}
//         </tbody>
//       </table>
//     </div>
//   );
// };

// export default TackingHisenseAuto;


import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import axios from 'axios';
import Swal from 'sweetalert2'; // Import SweetAlert2
import styles from './TackingHisense.module.css';

const TackingHisenseAuto = () => {
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

  const formatThaiDate = (isoDate) => {
    if (!isoDate) return '';
    const date = new Date(isoDate);
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear() + 543;
    return `${day}/${month}/${year}`;
  };

  const handlePrintLabel = (row) => {
    console.log("Viewing label data:", row);
  };

  const generateSerialNumber = (previousSerial) => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let serialArray = previousSerial.split('');

    for (let i = serialArray.length - 1; i >= 0; i--) {
      const index = chars.indexOf(serialArray[i]);
      if (index === -1) continue;
      if (index < chars.length - 1) {
        serialArray[i] = chars[index + 1];
        return serialArray.join('');
      } else {
        serialArray[i] = chars[0];
      }
    }

    return serialArray.join('');
  };

  const isSerialExists = async (serial) => {
    try {
      const checkResponse = await axios.post(
        'http://172.16.1.133:8088/wh-b8/api/checkSerialNumbers.php',
        { serialNumbers: [serial] }
      );
      return checkResponse.data.duplicates && checkResponse.data.duplicates.length > 0;
    } catch (error) {
      console.error('Error checking serial number:', error);
      return true;
    }
  };

  const getImageBase64 = async (matNo) => {
    try {
      const response = await axios.get(getImageUrl(matNo), { responseType: 'arraybuffer' });
      const base64Image = btoa(
        new Uint8Array(response.data).reduce((data, byte) => data + String.fromCharCode(byte), '')
      );
      return `data:image/jpeg;base64,${base64Image}`;
    } catch (error) {
      console.error('Error fetching image:', error);
      return null;
    }
  };

  const getImageUrl = (matNo) => {
    return `/imagepart/${matNo}.jpg`; // Assuming images are stored in /public/imagepart
  };

  const handlePrintAndGenerateSerial = async (row) => {
    // Show loading popup using SWAL2
    const loadingPopup = Swal.fire({
      title: 'Generating serial numbers...',
      text: 'Please wait...',
      allowOutsideClick: false,
      didOpen: () => {
        Swal.showLoading();
      },
    });

    const formData = {
      jobOrder: row.job_order || '',
      customerName: row.customer || '',
      supplier: 'SNC SERENITY CO.,LTD',
      partCode: row.part_code || '',
      mat: row.material || '',
      color: row.color || '',
      model: row.model || '',
      partName: row.part_name || '',
      quantityStd: row.quantity_std || '',
      matNo: row.mat_no || '',
    };

    if (row.customer === "HISENSE") {
      formData.customerName += " - SCAN";
    }

    let previousSerial = 'AAAAAA';
    let newSerialNumbers = [];

    for (let i = 0; i < calculateLabelTarget(row.label_target); i++) {
      let serial;
      let isDuplicate = true;

      while (isDuplicate) {
        previousSerial = generateSerialNumber(previousSerial);
        serial = previousSerial;
        isDuplicate = await isSerialExists(serial);
      }
      newSerialNumbers.push(serial);
    }

    const currentDate = new Date().toLocaleDateString('en-GB');
    const latestSerialNumber = newSerialNumbers[newSerialNumbers.length - 1];

    try {
      const base64Image = await getImageBase64(row.mat_no);

      const saveResponse = await axios.post(
        'http://172.16.1.133:8088/wh-b8/api/generate.php',
        {
          serialNumbers: newSerialNumbers,
          formData: formData,
          generateDate: currentDate,
        }
      );

      if (saveResponse.data.status === 'success') {
        // Update loading popup message
        loadingPopup.update({
          title: 'Printing in progress...',
        });

        const payload = {
          form_data: formData,
          serial_number: latestSerialNumber,
          image: base64Image,
          state: "1",
        };

        const printResponse = await axios.post('http://127.0.0.1:5000/printtest', payload);

        if (printResponse.data.message === "Print job sent successfully") {
          Swal.fire('Success!', 'Print job sent successfully.', 'success');
        } else {
          Swal.fire('Error!', 'Failed to send print job.', 'error');
        }
      } else {
        Swal.fire('Error!', 'Error saving serial numbers.', 'error');
      }
    } catch (error) {
      Swal.fire('Error!', 'Error saving serial numbers or sending print job.', 'error');
    } finally {
      // Close the loading popup
      Swal.close();
    }
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
            <th>พิมพ์</th>
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
                <td>
                  <button className={styles.button} onClick={() => handlePrintAndGenerateSerial(row)}>Print</button>
                </td>
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan="13" style={{ textAlign: 'center' }}>ไม่มีข้อมูล</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
};

export default TackingHisenseAuto;
