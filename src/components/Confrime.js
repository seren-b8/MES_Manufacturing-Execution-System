// src/components/ConfirmPage.js

import React, { useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

const ConfirmPage = () => {
  const [formData, setFormData] = useState({
    customerName: 'ABC Corp',
    model: 'Model X',
    supplier: 'Supplier Name',
    jobOrder: '12345',
    partCode: 'P1234',
    mat: 'Aluminum',
    color: 'Silver',
    partName: 'Cooling Fan',
    matNo: 'MAT001',
    quantityStd: '50',
    state: 'confrime',
    serialNumbers: ['123546789'] // เพิ่ม serialNumbers ลงใน formData
  });

  const navigate = useNavigate();

  // ฟังก์ชันจัดการการเปลี่ยนแปลงค่าในฟอร์ม
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prevData) => ({
      ...prevData,
      [name]: value,
    }));
  };

  // ฟังก์ชันส่งข้อมูลไปยัง API และเปลี่ยนหน้าไปยัง PrintLabelsAuto
  const handleConfirm = async () => {
    try {
      // ส่งข้อมูลไปยัง API
      const response = await axios.post('http://10.1.8.163:3005/confrim', formData);
      const data = response.data;

      // เปลี่ยนหน้าไปยัง PrintLabelsAuto พร้อมข้อมูลจาก API
      navigate('/PrintLabelsAuto', { state: data });
    } catch (error) {
      console.error("Error sending data:", error);
    }
  };

  return (
    <div>
      <h2>Submit Form</h2>
      <form>
        <label>
          Customer Name:
          <input type="text" name="customerName" value={formData.customerName} onChange={handleChange} />
        </label>
        <label>
          Model:
          <input type="text" name="model" value={formData.model} onChange={handleChange} />
        </label>
        <label>
          Supplier:
          <input type="text" name="supplier" value={formData.supplier} onChange={handleChange} />
        </label>
        <label>
          Job Order:
          <input type="text" name="jobOrder" value={formData.jobOrder} onChange={handleChange} />
        </label>
        <label>
          Part Code:
          <input type="text" name="partCode" value={formData.partCode} onChange={handleChange} />
        </label>
        <label>
          Material:
          <input type="text" name="mat" value={formData.mat} onChange={handleChange} />
        </label>
        <label>
          Color:
          <input type="text" name="color" value={formData.color} onChange={handleChange} />
        </label>
        <label>
          Part Name:
          <input type="text" name="partName" value={formData.partName} onChange={handleChange} />
        </label>
        <label>
          Material No:
          <input type="text" name="matNo" value={formData.matNo} onChange={handleChange} />
        </label>
        <label>
          Quantity (Standard):
          <input type="text" name="quantityStd" value={formData.quantityStd} onChange={handleChange} />
        </label>
        <label>
          Serial Numbers:
          <input type="text" name="serialNumbers" value={formData.serialNumbers} onChange={(e) => handleChange({
            target: { name: 'serialNumbers', value: e.target.value.split(',') }
          })} />
          <small>Separate multiple serial numbers with commas</small>
        </label>
        <button type="button" onClick={handleConfirm}>Confirm and Send to API</button>
      </form>
    </div>
  );
};

export default ConfirmPage;
