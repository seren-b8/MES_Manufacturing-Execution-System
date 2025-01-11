// import React, { useState } from 'react';
// import * as XLSX from 'xlsx';
// import './ExcelUpload.css'; // นำเข้าการจัดแต่งด้วย CSS

// const ExcelUpload = () => {
//   const [sheetNames, setSheetNames] = useState([]);
//   const [selectedSheet, setSelectedSheet] = useState("");
//   const [filteredData, setFilteredData] = useState([]);

//   const handleFileUpload = (e) => {
//     const file = e.target.files[0];
//     const reader = new FileReader();

//     reader.onload = (event) => {
//       const binaryStr = event.target.result;
//       const workbook = XLSX.read(binaryStr, { type: 'binary' });

//       const sheetNames = workbook.SheetNames;
//       setSheetNames(sheetNames); 

//       if (sheetNames.length > 0) {
//         setSelectedSheet(sheetNames[0]);
//         handleSheetData(workbook, sheetNames[0]);
//       }
//     };

//     reader.readAsBinaryString(file);
//   };

//   const handleSheetData = (workbook, sheetName) => {
//     const worksheet = workbook.Sheets[sheetName];
//     const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

//     const filtered = jsonData.slice(6).map((row) => {
//       const jobOrder = row[2]
//       const partCode = row[3];
//       const partName = row[4];
//       const color = row[5]; 
//       const target = row[9];
//       const customer = row[18];
//       const material = row[31];

//       if (target && parseInt(target) !== 0 && partCode && partName) {
//         return {
//           jobOrder,
//           partCode,
//           partName,
//           color,
//           target: Math.floor(target),
//           customer: customer || '',
//           material,
//         };
//       } else {
//         return null;
//       }

//     }).filter(row => row !== null);

//     setFilteredData(filtered); 
//     // console.log(jsonData)
//   };

//   const handleSheetChange = (e) => {
//     const sheetName = e.target.value;
//     setSelectedSheet(sheetName);

//     const file = document.querySelector('input[type="file"]').files[0];
//     const reader = new FileReader();

//     reader.onload = (event) => {
//       const binaryStr = event.target.result;
//       const workbook = XLSX.read(binaryStr, { type: 'binary' });
//       handleSheetData(workbook, sheetName);
//     };

//     reader.readAsBinaryString(file);
//   };

//   const uploadToDatabase = async () => {
//     // ตรวจสอบว่า filteredData มีค่าครบทุกฟิลด์หรือไม่ ถ้าไม่มีให้กำหนดเป็น null
//     const sanitizedData = filteredData.map(row => ({
//         partCode: row.partCode || null,
//         partName: row.partName || null,
//         color: row.color || null,
//         target: row.target || null,
//         customer: row.customer || null,
//         material: row.material || null,
//         jobOrder: row.jobOrder || null,
//     }));

//     const response = await fetch('http://172.16.1.133:8088/wh-b8/api/uploadPlan.php', {
//         method: 'POST',
//         headers: {
//             'Content-Type': 'application/json',
//         },
//         body: JSON.stringify(sanitizedData), // ส่ง sanitizedData ไปยัง PHP
//     });

//     const result = await response.json();
//     if (result.success) {
//         alert('Upload Successful');
//     } else {
//         alert('Upload Failed');
//     }
// };

//   return (
//     <div className="upload-section">
//       <h2>Upload Production Order</h2>
//       <input type="file" accept=".xlsx, .xls" onChange={handleFileUpload} />

//       {sheetNames.length > 0 && (
//         <div>
//           <h3>Select Sheet Name</h3>
//           <select className="select-dropdown" value={selectedSheet} onChange={handleSheetChange}>
//             {sheetNames.map((name, index) => (
//               <option key={index} value={name}>
//                 {name}
//               </option>
//             ))}
//           </select>

//           <h3>Data from {selectedSheet}</h3>
//           <table>
//             <thead>
//               <tr>
//                 <th>No.</th>
//                 <th>Job Order</th>
//                 <th>Part Code</th>
//                 <th>Part Name</th>
//                 <th>Color</th>
//                 <th>Target</th>
//                 <th>Customer</th>
//                 <th>Material</th>
//               </tr>
//             </thead>
//             <tbody>
//               {filteredData.map((row, rowIndex) => (
//                 <tr key={rowIndex}>
//                   <td>{rowIndex+1}</td>
//                   <td>{row.jobOrder}</td>
//                   <td>{row.partCode}</td>
//                   <td>{row.partName}</td>
//                   <td>{row.color}</td>
//                   <td>{row.target}</td>
//                   <td>{row.customer}</td>
//                   <td>{row.material}</td>
//                 </tr>
//               ))}
//             </tbody>
//           </table>

//           <button onClick={uploadToDatabase}>Upload to Database</button>
//         </div>
//       )}
//     </div>
//   );
// };

// export default ExcelUpload;


import React, { useState } from 'react';
import * as XLSX from 'xlsx';
import { Container, Button, Table, Form, Row, Col } from 'react-bootstrap';

const ExcelUpload = () => {
  const [sheetNames, setSheetNames] = useState([]);
  const [selectedSheet, setSelectedSheet] = useState("");
  const [filteredData, setFilteredData] = useState([]);

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    const reader = new FileReader();

    reader.onload = (event) => {
      const binaryStr = event.target.result;
      const workbook = XLSX.read(binaryStr, { type: 'binary' });

      const sheetNames = workbook.SheetNames;
      setSheetNames(sheetNames);

      if (sheetNames.length > 0) {
        setSelectedSheet(sheetNames[0]);
        handleSheetData(workbook, sheetNames[0]);
      }
    };

    reader.readAsBinaryString(file);
  };

  const handleSheetData = (workbook, sheetName) => {
    const worksheet = workbook.Sheets[sheetName];
    const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

    const filtered = jsonData.slice(6).map((row) => {
      const jobOrder = row[2];
      const partCode = row[3];
      const partName = row[4];
      const color = row[5];
      const target = row[9];
      const customer = row[18];
      const material = row[31];

      if (target && parseInt(target) !== 0 && partCode && partName) {
        return {
          jobOrder,
          partCode,
          partName,
          color,
          target: Math.floor(target),
          customer: customer || '',
          material,
        };
      } else {
        return null;
      }
    }).filter(row => row !== null);

    setFilteredData(filtered);
  };

  const handleSheetChange = (e) => {
    const sheetName = e.target.value;
    setSelectedSheet(sheetName);

    const file = document.querySelector('input[type="file"]').files[0];
    const reader = new FileReader();

    reader.onload = (event) => {
      const binaryStr = event.target.result;
      const workbook = XLSX.read(binaryStr, { type: 'binary' });
      handleSheetData(workbook, sheetName);
    };

    reader.readAsBinaryString(file);
  };

  const uploadToDatabase = async () => {
    const sanitizedData = filteredData.map(row => ({
      partCode: row.partCode || null,
      partName: row.partName || null,
      color: row.color || null,
      target: row.target || null,
      customer: row.customer || null,
      material: row.material || null,
      jobOrder: row.jobOrder || null,
    }));

    const response = await fetch('http://172.16.1.133:8088/wh-b8/api/uploadPlan.php', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(sanitizedData),
    });

    const result = await response.json();
    if (result.success) {
      alert('Upload Successful');
    } else {
      alert('Upload Failed');
    }
  };

  return (
    <Container className="my-4 p-4 bg-light rounded">
      <h2 className="mb-4">Upload Production Order</h2>
      <Form.Group className="mb-3">
        <Form.Control
          type="file"
          accept=".xlsx, .xls"
          onChange={handleFileUpload}
        />
      </Form.Group>

      {sheetNames.length > 0 && (
        <div>
          <h4 className="mb-3">Select Sheet Name</h4>
          <Form.Group as={Row} className="mb-3">
            <Col>
              <Form.Select value={selectedSheet} onChange={handleSheetChange}>
                {sheetNames.map((name, index) => (
                  <option key={index} value={name}>
                    {name}
                  </option>
                ))}
              </Form.Select>
            </Col>
          </Form.Group>

          <h4 className="mb-3">Data from {selectedSheet}</h4>
          <div className="table-responsive">
            <Table striped bordered hover>
              <thead>
                <tr>
                  <th>No.</th>
                  <th>Job Order</th>
                  <th>Part Code</th>
                  <th>Part Name</th>
                  <th>Color</th>
                  <th>Target</th>
                  <th>Customer</th>
                  <th>Material</th>
                </tr>
              </thead>
              <tbody>
                {filteredData.map((row, rowIndex) => (
                  <tr key={rowIndex}>
                    <td>{rowIndex + 1}</td>
                    <td>{row.jobOrder}</td>
                    <td>{row.partCode}</td>
                    <td>{row.partName}</td>
                    <td>{row.color}</td>
                    <td>{row.target}</td>
                    <td>{row.customer}</td>
                    <td>{row.material}</td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </div>

          <Button variant="primary" className="mt-3" onClick={uploadToDatabase}>
            Upload to Database
          </Button>
        </div>
      )}
    </Container>
  );
};

export default ExcelUpload;
