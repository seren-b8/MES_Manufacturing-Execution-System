import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom'; // ใช้สำหรับการนำทาง
import axios from 'axios';
import './GenerateLabels.css'; // นำเข้าไฟล์ CSS

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
      serialArray[i] = chars[0]; // ตั้งค่าตัวอักษรนี้เป็นตัวแรก 'A' หรือ '0'
    }
  }

  return serialArray.join('');
};

const GenerateLabels = () => {
  const location = useLocation(); // ดึงข้อมูลจาก state ที่ส่งมาจาก TackingHisense
  const formData = location.state?.formData; // ข้อมูล formData ที่ส่งมาจาก TackingHisense
  const [labelCount, setLabelCount] = useState(1); // state สำหรับจำนวน labels
  const [serialNumbers, setSerialNumbers] = useState([]); // เก็บ Serial Number
  const navigate = useNavigate(); // ใช้ navigate สำหรับการนำทาง

  useEffect(() => {
    // ใช้ labelTarget จาก formData ถ้ามี
    if (formData && formData.labelTarget) {
      setLabelCount(formData.labelTarget); 
    }
    console.log(formData)
  }, [formData]);

  if (!formData) {
    return <div>No Data Available</div>;
  }

  // ฟังก์ชันตรวจสอบว่าซีเรียลนัมเบอร์ซ้ำหรือไม่
  const isSerialExists = async (serial) => {
    try {
      const checkResponse = await axios.post(
        'http://172.16.1.133:8088/wh-b8/api/checkSerialNumbers.php',
        { serialNumbers: [serial] }
      );
      return checkResponse.data.duplicates && checkResponse.data.duplicates.length > 0;
    } catch (error) {
      console.error('Error checking serial number:', error);
      return true; // ถ้าเกิดข้อผิดพลาดให้ถือว่าซีเรียลซ้ำเพื่อเจนใหม่
    }
  };

  const handleGenerateLabels = async () => {
    let previousSerial = 'AAAAAA'; // ค่าเริ่มต้นสำหรับ Serial ถ้าไม่มีในฐานข้อมูล
    let newSerialNumbers = [];

    // วนลูปเพื่อเจนซีเรียลนัมเบอร์
    for (let i = 0; i < labelCount; i++) {
      let serial;
      let isDuplicate = true;

      // เจนซีเรียลจนกว่าจะได้ซีเรียลที่ไม่ซ้ำ
      while (isDuplicate) {
        previousSerial = generateSerialNumber(previousSerial); // เจนซีเรียลใหม่
        serial = previousSerial;
        isDuplicate = await isSerialExists(serial); // ตรวจสอบว่าซีเรียลซ้ำหรือไม่
      }

      newSerialNumbers.push(serial); // เก็บซีเรียลนัมเบอร์ที่ไม่ซ้ำ
    }

    const today = new Date();
    const day = today.getDate().toString().padStart(2, '0');
    const month = (today.getMonth() + 1).toString().padStart(2, '0');
    const year = today.getFullYear();
    const currentDate = `${day}/${month}/${year}`; // รูปแบบ DD/MM/YYYY

    // เก็บซีเรียลนัมเบอร์ที่เจนได้
    setSerialNumbers(newSerialNumbers);

    // บันทึกซีเรียลนัมเบอร์ลงฐานข้อมูล
    try {
      const saveResponse = await axios.post(
        'http://172.16.1.133:8088/wh-b8/api/generate.php',
        {
          serialNumbers: newSerialNumbers,
          formData: formData,
          generateDate: currentDate,
        }
      );

      if (saveResponse.data.status === 'success') {
        console.log('Serial numbers saved successfully');
      } else {
        alert('Error saving serial numbers.');
      }
    } catch (error) {
      console.error('Error saving serial numbers:', error);
    }
  };

  const handlePrint = async () => {
    let newSerialNumbers = [];
    let previousSerial = 'AAAAAA'; // Serial เริ่มต้น
    for (let i = 0; i < labelCount; i++) {
      previousSerial = generateSerialNumber(previousSerial);
      newSerialNumbers.push(previousSerial);
    }
  
    const today = new Date();
    const day = today.getDate().toString().padStart(2, '0');
    const month = (today.getMonth() + 1).toString().padStart(2, '0');
    const year = today.getFullYear();
    const currentDate = `${day}/${month}/${year}`; // รูปแบบ DD/MM/YYYY
  
    setSerialNumbers(newSerialNumbers); // เก็บ serial numbers ที่เจนได้
  
    // อัปเดต formData ด้วยวันที่ปัจจุบัน
    const updatedFormData = { ...formData, date: currentDate };
  
    try {
      // ส่งข้อมูลไปยัง API เพื่อบันทึกข้อมูลลงฐานข้อมูล
      const saveResponse = await axios.post(
        'http://172.16.1.133:8088/wh-b8/api/saveLabelData.php', // ใช้ API ตาม PHP ที่ได้สร้างไว้
        {
          username: updatedFormData.username,
          shift: updatedFormData.shift,
          line: updatedFormData.line,
          partName: updatedFormData.partName,
          machineNo: updatedFormData.machineNo,
          labelTarget: updatedFormData.labelTarget
        }
      );
  
      if (saveResponse.data.status === 'success') {
        console.log('Data saved successfully');
  
        // เมื่อบันทึกข้อมูลสำเร็จแล้วทำการพิมพ์
        navigate('/print', {
          state: { formData: updatedFormData, serialNumbers: newSerialNumbers }
        });
      } else {
        alert('Error saving data.');
      }
    } catch (error) {
      console.error('Error saving data:', error);
    }
  }; 

  const getImageUrl = (matNo) => {
    try {
      return `/imagepart/${matNo}.jpg`; // สมมติว่ารูปภาพถูกเก็บใน public/imagepart
    } catch (error) {
      return '/imagepart/default.jpg'; // ถ้าไม่พบรูปภาพ จะใช้รูปภาพเริ่มต้นแทน
    }
  };

  return (
    <div>
      <div className="container">
        <h1>Generate Labels</h1>
        <label htmlFor="labelCount">Number of labels to generate: </label>
        <input 
          type="number" 
          id="labelCount" 
          min="1" 
          value={labelCount} // Displays the current value of labelCount
          onChange={(e) => setLabelCount(e.target.value)} // Allows the user to edit the value
        />

        {/* ปุ่มเจนเนเรท labels */}
        <button onClick={handleGenerateLabels}>Generate Labels</button>

        {/* ปุ่มพิมพ์ */}
        <button onClick={handlePrint}>Print Labels</button>

        <div className="formsWrapper">
          {serialNumbers.map((serialNumber, index) => (
            <div className="formContainer" key={index}>
              <table>
                <tbody>
                  <tr>
                    <td colSpan="5" className="customerTitle">
                      Customer Name: SCAN - {formData?.customerName || 'Unknown'} 
                      &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
                      &nbsp;&nbsp;&nbsp;
                      Model {formData?.model || 'Unknown'}
                      <div className="modelBox">{index + 1}</div>
                    </td>
                  </tr>
                  <tr>
                    <td colSpan="1" className="customerTitle">Supplier</td>
                    <td colSpan="3" className="customerTitle">{formData?.supplier || 'SNC SERENITY CO.,LTD'}
                    &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
                    Job No. : {formData?.jobOrder || ''}
                    </td>
                  </tr>
                  <tr>
                    <td className="smallText" rowSpan="2">Part Code</td>
                    <td className="largeText" rowSpan="2">{formData?.partCode || 'N/A'}</td>
                    <td className="smallText">Mat'l</td>
                    <td className="mediumText">{formData?.mat || 'N/A'}</td>
                  </tr>
                  <tr>
                    <td className="smallText">Color</td>
                    <td className="mediumText">{formData?.color || 'N/A'}</td>
                  </tr>
                  <tr>
                    <td className="smallText" rowSpan="2">Part Name</td>
                    <td className="mediumTextbig" rowSpan="2">{formData?.partName || 'N/A'}</td>
                    <td className="smallText">Producer</td>
                    <td className="mediumText"></td>
                  </tr>
                  <tr>
                    <td className="smallText">Date</td>
                    <td className="mediumText"></td>
                  </tr>
                  <tr>
                    <td colSpan="2" className="imageBase">
                      <div className="pictureText">Picture of Part</div>
                      <img
                        src={getImageUrl(formData.matNo) || 'default_image_path'} 
                        alt="Product"
                        style={{ marginTop: '30px', width: '105px', height: '85px' }}
                      />
                      <div className="qrCode">
                        <img
                          src={`https://api.qrserver.com/v1/create-qr-code/?size=140x140&data=${formData?.matNo || ''}|${serialNumber}`}
                          alt="QR Code"
                        />
                      </div>
                    </td>
                    <td colSpan="2" className="leftAlign">
                      <div className="qText">Quantity (Unit)</div>
                      <div className="centerAlignSpan">{formData?.quantityStd || 'N/A'}</div>
                      <div className="smallText">RoHS2 <span className="rightAlignSpan">PCS.</span></div>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default GenerateLabels;
