// import React, { useState } from 'react';
// import { BrowserRouter as Router, Route, Routes, Navigate, useLocation } from 'react-router-dom';
// import Navbar from './components/Navbar'; 
// import MainPage from './components/MainPage'; 
// import UploadAndProcessExcel from './components/UploadAndProcessExcel'; 
// import GenerateLabels from './components/GenerateLabels'; 
// import PrintLabels from './components/PrintLabels'; 
// import ExcelUpload from './components/ImportPlan_Order';
// import TackingHisense from './components/TackingHisense';
// import ReportIssueTag from './components/ReportIssueTag';
// import Login from './components/Login';
// import SummaryCharts from './components/SummaryCharts';
// import PrintLabelsAuto from './components/printLabelsAuto';
// import ConfirmPage from './components/Confrime';
// import 'bootstrap/dist/css/bootstrap.min.css';

// function Layout() {
//   const location = useLocation();

//   const shouldShowNavbar = ['/MainPage', '/inputFrom', '/importPlan', '/TackingHisense', '/report', '/Dashboard'].includes(location.pathname);

//   return (
//     <>
//       {shouldShowNavbar && <Navbar />}
//     </>
//   );
// }

// function App() {
//   const [formData, setFormData] = useState(null); 

//   return (
//     <Router>
//       <Layout />
//       <Routes>
//       <Route path="/" element={<Navigate to="/login" />}/>
//         <Route path="/login" element={<Login />} />
//         <Route path="/MainPage" element={<MainPage />} />
//         <Route path="/importPlan" element={<ExcelUpload />} />
//         <Route path="/inputFrom" element={<UploadAndProcessExcel setFormData={setFormData} />} />
//         <Route path="/generateLabels" element={<GenerateLabels formData={formData} />} />
//         <Route path="/TackingHisense" element={<TackingHisense />} />
//         <Route path="/print" element={<PrintLabels />} />
//         <Route path="/report" element={<ReportIssueTag />} />
//         <Route path="/Dashboard" element={<SummaryCharts/>}/>
//         <Route path='/PrintLabelsAuto' element={<PrintLabelsAuto/>}/>
//         <Route path='/Confrime' element={<ConfirmPage/>}/>
//       </Routes>
//     </Router>
//   );
// }

// export default App;

import React, { useState } from 'react';
import { BrowserRouter as Router, Route, Routes, Navigate, useLocation } from 'react-router-dom';
import Navbar from './components/Navbar'; 
import MainPage from './components/MainPage'; 
import UploadAndProcessExcel from './components/UploadAndProcessExcel'; 
import GenerateLabels from './components/GenerateLabels'; 
import PrintLabels from './components/PrintLabels'; 
import ExcelUpload from './components/ImportPlan_Order';
// import TackingHisense from './components/TackingHisense';
import TackingHisenseAuto from './components/TackingHisenseAuto';
import ReportIssueTag from './components/ReportIssueTag';
import Login from './components/Login';
import SummaryCharts from './components/SummaryCharts';
import PrintLabelsAuto from './components/PrintTrigger'; // Ensure the correct import
import ConfirmPage from './components/Confrime'; // Ensure the correct import
import ErrorBoundary from './components/ErrorBoundary'; // Ensure the correct import
import 'bootstrap/dist/css/bootstrap.min.css';

function Layout() {
  const location = useLocation();

  // const shouldShowNavbar = ['/MainPage', '/inputFrom', '/importPlan', '/TackingHisense', '/report', '/Dashboard'].includes(location.pathname);
  const shouldShowNavbar = ['/MainPage', '/inputFrom', '/importPlan', '/TackingHisenseAuto', '/report', '/Dashboard'].includes(location.pathname);
  return (
    <>
      {shouldShowNavbar && <Navbar />}
    </>
  );
}

function App() {
  const [formData, setFormData] = useState(null);

  return (
    <Router>
      <Layout />
      <ErrorBoundary>
        <Routes>
          <Route path="/" element={<Navigate to="/login" />} />
          <Route path="/login" element={<Login />} />
          <Route path="/MainPage" element={<MainPage />} />
          <Route path="/importPlan" element={<ExcelUpload />} />
          <Route path="/inputFrom" element={<UploadAndProcessExcel setFormData={setFormData} />} />
          <Route path="/generateLabels" element={<GenerateLabels formData={formData} />} />
          {/* <Route path="/TackingHisense" element={<TackingHisense />} /> */}
          <Route path="/TackingHisenseAuto" element={<TackingHisenseAuto />} />
          <Route path="/print" element={<PrintLabels />} />
          <Route path="/report" element={<ReportIssueTag />} />
          <Route path="/Dashboard" element={<SummaryCharts />} />
          <Route path="/PrintLabelsAuto" element={<PrintLabelsAuto />} />
          <Route path="/Confrime" element={<ConfirmPage />} />
        </Routes>
      </ErrorBoundary>
    </Router>
  );
}

export default App;
