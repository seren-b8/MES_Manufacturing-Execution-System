import React, { useState } from "react";
import * as XLSX from "xlsx";
import { useNavigate } from "react-router-dom";
import './UploadAndProcessExcel.css'; // Import CSS

const UploadAndProcessExcel = ({ setFormData }) => {
  const [data, setData] = useState([]);
  const [selectedData, setSelectedData] = useState({
    customerName: "",
    model: "",
    partCode: "",
    mat: "",
    partName: "",
    quantity: "",
    imageUrl: "" // สำหรับเก็บ URL ของรูปภาพ
  });
  const [selectedIndex, setSelectedIndex] = useState("");
  const [quantity, setQuantity] = useState(""); // สำหรับ quantity
  const [errorMessage, setErrorMessage] = useState(""); // สำหรับแสดงข้อความ error
  const navigate = useNavigate();

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    const reader = new FileReader();

    reader.onload = (event) => {
      const binaryStr = event.target.result;
      const workbook = XLSX.read(binaryStr, { type: "binary" });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];

      // ใช้ header: 1 เพื่อดึงข้อมูลทุกแถวรวมถึงหัวตาราง แล้วข้ามแถวแรกด้วย slice(1)
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }).slice(1);

      // console.log(jsonData); // ข้อมูลที่ได้จากแถวที่ 2 เป็นต้นไป
      setData(jsonData); // เก็บข้อมูลที่อ่านได้ใน state
    };

    reader.readAsBinaryString(file);
  };

  const getImageUrl = (materialNumber) => {
    return `${process.env.PUBLIC_URL}/imagepart/${materialNumber}.jpg`;
  };

  const handleMaterialSelection = (e) => {
    const selectedIndex = e.target.value;
    setSelectedIndex(selectedIndex);

    if (selectedIndex !== "") {
      const selectedRow = data[selectedIndex];
      const materialNumber = selectedRow[2]; // ดึง Material Number จากคอลัมน์ที่ 3 (C)

      setSelectedData({
        customerName: selectedRow[5], // Column F
        model: selectedRow[6], // Column G
        partCode: selectedRow[3], // Column D
        mat: selectedRow[7], // Column H
        partName: selectedRow[1], // Column B
        materialNumber: materialNumber, // เพิ่ม materialNumber ที่เลือกไว้
        imageUrl: getImageUrl(materialNumber) // ค้นหารูปภาพตาม Material Number
      });
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    // ตรวจสอบว่าผู้ใช้กรอกข้อมูลครบหรือไม่
    if (
      !selectedData.customerName ||
      !selectedData.model ||
      !selectedData.partCode ||
      !selectedData.mat ||
      !selectedData.partName ||
      !quantity
    ) {
      setErrorMessage("Please fill in all fields before submitting.");
      return;
    }

    // หากกรอกครบ ให้ส่งข้อมูลไปยังหน้าถัดไป
    setFormData({
      ...selectedData,
      quantity: quantity,
    });

    setErrorMessage(""); // ลบข้อความ error หากส่งฟอร์มสำเร็จ
    navigate("/generate");
  };

  return (
    <div className="upload-container">
      <h2>Upload Excel File</h2>
      <input type="file" accept=".xlsx, .xls" onChange={handleFileUpload} />

      {data.length > 0 && (
        <form onSubmit={handleSubmit}>
          <h3>Select Material Number</h3>
          <select value={selectedIndex} onChange={handleMaterialSelection}>
            <option value="">Select Material Number</option>
            {data.map((row, index) => (
              <option key={index} value={index}>
                {row[2]} {/* Material Number (คอลัมน์ C) */}
              </option>
            ))}
          </select>

          <h3>Form Data</h3>
          <label>
            Customer Name:
            <input type="text" value={selectedData.customerName} readOnly />
          </label>
          <br />
          <label>
            Model:
            <input type="text" value={selectedData.model} readOnly />
          </label>
          <br />
          <label>
            Part Code:
            <input type="text" value={selectedData.partCode} readOnly />
          </label>
          <br />
          <label>
            Material:
            <input type="text" value={selectedData.mat} readOnly />
          </label>
          <br />
          <label>
            Part Name:
            <input type="text" value={selectedData.partName} readOnly />
          </label>
          <br />
          <label>
            Quantity:
            <input
              type="number"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              placeholder="Enter quantity"
            />
          </label>
          <br />
          
          {errorMessage && <p style={{ color: "red" }}>{errorMessage}</p>} {/* แสดงข้อความ error */}
          <button type="submit">Submit</button>
        </form>
      )}
    </div>
  );
};

export default UploadAndProcessExcel;
