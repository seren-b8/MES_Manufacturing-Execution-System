// import React, { useEffect } from 'react';
// import { useLocation } from 'react-router-dom';
// import './GenerateLabels.css';

// const PrintLabels = () => {
//   const location = useLocation();
//   const { formData, serialNumbers } = location.state;

//   useEffect(() => {
//     if (formData && serialNumbers) {
//       const timer = setTimeout(() => {
//         window.print();
//       }, 2000);
//       return () => clearTimeout(timer);
//     }
//   }, [formData, serialNumbers]);

//   if (!formData || !serialNumbers) {
//     return <div style={{ textAlign: 'center' }}>No Data Available</div>;
//   }

//   const getImageUrl = (matNo) => {
//     try {
//       return `/imagepart/${matNo}.jpg`; // สมมติว่ารูปภาพถูกเก็บใน public/imagepart
//     } catch (error) {
//       return '/imagepart/default.jpg'; // ถ้าไม่พบรูปภาพ จะใช้รูปภาพเริ่มต้นแทน
//     }
//   };

//   return (
//     <div className="formsWrapper">
//       {serialNumbers.map((serialNumber, index) => (
//         <div className="formContainer" key={index}>
//           <table>
//             <tbody>
//               <tr>
//                 <td colSpan="8" className="customerTitle">
//                   Customer Name: SCAN - {formData.customerName}
//                   &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
//                   &nbsp; Model {formData.model}
//                   <div className="modelBox">{index + 1}</div>
//                 </td>
//               </tr>
//               <tr>
//                 <td colSpan="2" className="customerTitle">Supplier</td>
//                 <td colSpan="6" className="customerTitle">{formData?.supplier || 'SNC SERENITY CO.,LTD'}
//                 &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
//                 Job No. : {formData?.jobOrder || ''}
//                 </td>
//               </tr>
//               <tr>
//                 <td colSpan="2" className="smallText" rowSpan="2">Part Code</td>
//                 <td colSpan="2" style={{textAlign: 'center'}} className="centerAlignSpan" rowSpan="2">{formData.partCode}</td>
//                 <td colSpan="2" className="smallText">Mat'l</td>
//                 <td colSpan="2" style={{fontSize:'12px', textAlign:'center', wordWrap: 'break-word', maxWidth: '500px' }}>
//                   {formData.mat}
//                 </td>
//               </tr>
//               <tr>
//                 <td colSpan="2" className="smallText">Color</td>
//                 <td colSpan="2" className="mediumText">{formData.color}</td>
//               </tr>
//               <tr>
//                 <td colSpan="2" className="smallText" rowSpan="2">Part Name</td>
//                 <td colSpan="2" className="mediumTextbig" rowSpan="2">{formData.partName}</td>
//                 <td colSpan="2" className="smallText" >Producer</td>
//                 <td colSpan="2" className="mediumText" style={{fontSize:'12px', textAlign:'center', wordWrap: 'break-word', maxWidth: '500px' }}></td>
//               </tr>
//               <tr>
//                 <td colSpan="2" className="smallText">Date</td>
//                 <td colSpan="3" className="mediumText" style={{fontSize:'12px', textAlign:'center', wordWrap: 'break-word', maxWidth: '500px' }}></td>
//               </tr>
//               <tr>
//                 <td colSpan="4" className="imageBase">
//                 <div className="smallText">Picture of Part</div>
//                   <img
//                     src={getImageUrl(formData.matNo) || 'default_image_path'} 
//                     alt="Product"
//                     className='img'
//                   />
//                   <div className="qrCode">
//                     <img
//                       src={`https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=
//                         ${formData.matNo}|${serialNumber}
//                       `}
//                       alt="QR Code"
//                       style={{ marginTop: '0px'}}
//                     />
//                   </div>
//                 </td>
//                 <td colSpan="3" className="leftAlign">
//                   <div className="qText" style={{marginBottom:'85px'}}>Quantity (Unit) <br></br></div>
//                   <div className="centerAlignSpan" style={{marginBottom:'65px'}}>{formData.quantityStd} <br></br></div>
//                   <div className="smallText">RoHS2<span className="rightAlignSpan">PCS.</span></div>
//                 </td>
//               </tr>
//             </tbody>
//           </table>
//         </div>
//       ))}
//     </div>
//   );
// };

// export default PrintLabels;


import React, { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import styles from './PrintLabels.module.css'; // Import CSS Module

const PrintLabels = () => {
  const location = useLocation();
  const { formData, serialNumbers } = location.state;

  useEffect(() => {
    if (formData && serialNumbers) {
      const timer = setTimeout(() => {
        window.print();
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [formData, serialNumbers]);

  if (!formData || !serialNumbers) {
    return <div style={{ textAlign: 'center' }}>No Data Available</div>;
  }

  const getImageUrl = (matNo) => {
    try {
      return `/imagepart/${matNo}.jpg`; // สมมติว่ารูปภาพถูกเก็บใน public/imagepart
    } catch (error) {
      return '/imagepart/default.jpg'; // ถ้าไม่พบรูปภาพ จะใช้รูปภาพเริ่มต้นแทน
    }
  };

  return (
    <div className={styles.formsWrapper}> {/* ใช้ styles. เพื่ออ้างถึง CSS Module */}
      {serialNumbers.map((serialNumber, index) => (
        <div className={styles.formContainert} key={index}>
          <table>
            <tbody>
              <tr>
                <td colSpan="8" className={styles.customerTitle}>
                  Customer Name: SCAN - {formData.customerName}
                  &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
                  &nbsp; Model {formData.model}
                  <div className={styles.modelBox}>{index + 1}</div>
                </td>
              </tr>
              <tr>
                <td colSpan="2" className={styles.customerTitle}>Supplier</td>
                <td colSpan="6" className={styles.customerTitle}>{formData?.supplier || 'SNC SERENITY CO.,LTD'}
                &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
                Job No. : {formData?.jobOrder || ''}
                </td>
              </tr>
              <tr>
                <td colSpan="2" className={styles.smallText} rowSpan="2">Part Code</td>
                <td colSpan="2" style={{textAlign: 'center'}} className={styles.centerAlignSpan} rowSpan="2">{formData.partCode}</td>
                <td colSpan="2" className={styles.smallText}>Mat'l</td>
                <td colSpan="2" style={{fontSize:'12px', textAlign:'center', wordWrap: 'break-word', maxWidth: '500px' }}>
                  {formData.mat}
                </td>
              </tr>
              <tr>
                <td colSpan="2" className={styles.smallText}>Color</td>
                <td colSpan="2" className={styles.mediumText}>{formData.color}</td>
              </tr>
              <tr>
                <td colSpan="2" className={styles.smallText} rowSpan="2">Part Name</td>
                <td colSpan="2" className={styles.mediumTextbig} rowSpan="2">{formData.partName}</td>
                <td colSpan="2" className={styles.smallText}>Producer</td>
                <td colSpan="2" className={styles.mediumText} style={{fontSize:'12px', textAlign:'center', wordWrap: 'break-word', maxWidth: '500px' }}></td>
              </tr>
              <tr>
                <td colSpan="2" className={styles.smallText}>Date</td>
                <td colSpan="3" className={styles.mediumText} style={{fontSize:'12px', textAlign:'center', wordWrap: 'break-word', maxWidth: '500px' }}></td>
              </tr>
              <tr>
                <td colSpan="4" className={styles.imageBase}>
                <div className={styles.smallText}>Picture of Part</div>
                  <img
                    src={getImageUrl(formData.matNo) || 'default_image_path'} 
                    alt="Product"
                    className={styles.img}
                  />
                  <div className={styles.qrCode}>
                    <img
                      src={`https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=
                        ${formData.matNo}|${serialNumber}
                      `}
                      alt="QR Code"
                      style={{ marginTop: '0px'}}
                    />
                  </div>
                </td>
                <td colSpan="3" className={styles.leftAlign}>
                  <div className={styles.qText} style={{marginBottom:'15px'}}>Quantity (Unit) <br></br></div>
                  <div className={styles.centerAlignSpan} style={{marginBottom:'15px'}}>{formData.quantityStd} <br></br></div>
                  <div className={styles.smallText}>RoHS2<span className={styles.rightAlignSpan}> PCS.</span></div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      ))}
    </div>
  );
};

export default PrintLabels;
