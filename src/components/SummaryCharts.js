// import React, { useEffect, useState } from 'react';
// import { Pie, Bar } from 'react-chartjs-2';
// import { Chart, ArcElement, BarElement, CategoryScale, LinearScale, Tooltip, Legend, LineElement, PointElement } from 'chart.js';
// import axios from 'axios';
// import styles from './SummaryCharts.module.css';

// Chart.register(ArcElement, BarElement, CategoryScale, LinearScale, Tooltip, Legend, LineElement, PointElement);

// const SummaryCharts = () => {
//     const [monthlyData, setMonthlyData] = useState([]);
//     const [dailyData, setDailyData] = useState([]);
//     const [filteredDailyData, setFilteredDailyData] = useState([]);
//     const [selectedMonth, setSelectedMonth] = useState('');
//     const [loading, setLoading] = useState(true);

//     useEffect(() => {
//         axios.get('http://172.16.1.133:8088/wh-b8/api/Dashboarapi.php')
//             .then(response => {
//                 console.log(response.data.monthly);
//                 setMonthlyData(response.data.monthly || []);
//                 setDailyData(response.data.daily || []);
//                 setTimeout(() => {
//                     setLoading(false);
//                 }, 3000);
//             })
//             .catch(error => {
//                 console.error("Error fetching data:", error);
//                 setLoading(false);
//             });
//     }, []);

//     const getDaysInMonth = (month) => {
//         const date = new Date(month);
//         const daysInMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
//         return Array.from({ length: daysInMonth }, (_, i) => i + 1);
//     };

//     useEffect(() => {
//         if (selectedMonth) {
//             const filteredData = dailyData.filter(
//                 data => new Date(data.day).getMonth() === new Date(selectedMonth).getMonth() &&
//                         new Date(data.day).getFullYear() === new Date(selectedMonth).getFullYear()
//             );
//             const daysInMonth = getDaysInMonth(selectedMonth);

//             const dailyDataWithAllDays = daysInMonth.map(day => {
//                 const dataForDay = filteredData.find(data => new Date(data.day).getDate() === day);
//                 return { day, total: dataForDay ? dataForDay.total : 0 };
//             });
//             setFilteredDailyData(dailyDataWithAllDays);
//         } else {
//             setFilteredDailyData(dailyData);
//         }
//     }, [selectedMonth, dailyData]);

//     const handleMonthChange = (event) => {
//         setSelectedMonth(event.target.value);
//     };

//     if (loading) {
//         return (
//             <div className={styles.loadingContainer}>
//                 {'Loading...'.split('').map((letter, index) => (
//                     <span key={index} className={styles.loadingLetter} style={{ '--index': index }}>
//                         {letter}
//                     </span>
//                 ))}
//             </div>
//         );
//     }

//     const monthlyChartData = {
//         labels: monthlyData.map(data => new Date(data.month).toLocaleString('default', { month: 'long', year: 'numeric' })),
//         datasets: [
//             {
//                 data: monthlyData.map(data => data.total),
//                 backgroundColor: ['#FF6384', '#FB87FC', '#FFCE56', '#4BC0C0', '#9966FF', '#FF9F40'],
//             },
//         ],
//     };

//     const dailyChartData = {
//         labels: filteredDailyData.map(data => `Day ${data.day}`),
//         datasets: [
//             {
//                 type: 'bar',
//                 label: 'Total',
//                 data: filteredDailyData.map(data => data.total),
//                 backgroundColor: '#61ED44',
//                 order: 1, // Render the bar dataset first
//             },
//             {
//                 type: 'line',
//                 label: 'Trend Line',
//                 data: filteredDailyData.map(data => data.total),
//                 borderColor: '#FF6384',
//                 borderWidth: 2,
//                 fill: false,
//                 tension: 0.2,
//                 pointBackgroundColor: '#FF6384',
//                 pointBorderColor: '#FF6384',
//                 pointRadius: 4,
//                 order: 2, // Render the line dataset second
//             },
//         ],
//     };

//     return (
//         <div className={styles.container}>
//             <div className={styles.header}>
//                 <h2>Monthly and Daily Summary</h2>
//                 <div className={styles.selectContainer}>
//                     <label>Select Daily Summary by Month</label>
//                     <select className={styles.selectDropdown} value={selectedMonth} onChange={handleMonthChange}>
//                         <option value="">All Months</option>
//                         {monthlyData.map(data => (
//                             <option key={data.month} value={data.month}>
//                                 {new Date(data.month).toLocaleString('default', { month: 'long', year: 'numeric' })}
//                             </option>
//                         ))}
//                     </select>
//                 </div>
//             </div>
//             <div className={styles.chartRow}>
//                 <div className={styles.smallPieChart}>
//                     <label style={{marginBottom: '10px', textAlign:'center', flexDirection:'column'}}>Monthly Summary</label>
//                     <Pie data={monthlyChartData} width={100} height={100} />
//                 </div>
                
//                 <div className={styles.chartContainer}>
//                     <label style={{marginBottom: '10px', textAlign:'center', flexDirection:'column'}}>Daily Summary with Trend Line</label>
//                     <Bar 
//                         data={dailyChartData} 
//                         options={{ 
//                             responsive: true, 
//                             scales: { x: { beginAtZero: true } },
//                             plugins: {
//                                 legend: { display: true },
//                                 tooltip: { mode: 'index', intersect: false }
//                             }
//                         }} 
//                     />
//                 </div>
//             </div>
//         </div>
//     );
// };

// export default SummaryCharts;


import React, { useEffect, useState } from 'react';
import { Pie, Bar } from 'react-chartjs-2';
import { Chart, ArcElement, BarElement, CategoryScale, LinearScale, Tooltip, Legend, LineElement, PointElement } from 'chart.js';
import axios from 'axios';
import styles from './SummaryCharts.module.css';

Chart.register(ArcElement, BarElement, CategoryScale, LinearScale, Tooltip, Legend, LineElement, PointElement);

const SummaryCharts = () => {
    const [monthlyData, setMonthlyData] = useState([]);
    const [dailyData, setDailyData] = useState([]);
    const [filteredDailyData, setFilteredDailyData] = useState([]);
    const [selectedMonth, setSelectedMonth] = useState('');
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        axios.get('http://172.16.1.133:8088/wh-b8/api/Dashboarapi.php')
            .then(response => {
                setMonthlyData(response.data.monthly || []);
                setDailyData(response.data.daily || []);
                
                setTimeout(() => {
                    setLoading(false);
                }, 3000);
            })
            .catch(error => {
                console.error("Error fetching data:", error);
                setLoading(false);
            });
    }, []);

    const getDaysInMonth = (month) => {
        const date = new Date(month);
        const daysInMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
        return Array.from({ length: daysInMonth }, (_, i) => i + 1);
    };

    useEffect(() => {
        if (selectedMonth) {
            const filteredData = dailyData.filter(
                data => new Date(data.day).getMonth() === new Date(selectedMonth).getMonth() &&
                        new Date(data.day).getFullYear() === new Date(selectedMonth).getFullYear()
            );
            const daysInMonth = getDaysInMonth(selectedMonth);

            const dailyDataWithAllDays = daysInMonth.map(day => {
                const dataForDay = filteredData.find(data => new Date(data.day).getDate() === day);
                return { day, total: dataForDay ? dataForDay.total : 0 };
            });
            setFilteredDailyData(dailyDataWithAllDays);
        } else {
            setFilteredDailyData(dailyData);
        }
    }, [selectedMonth, dailyData]);

    const handleMonthChange = (event) => {
        setSelectedMonth(event.target.value);
    };

    const generateMonthOptions = () => {
        const currentYear = new Date().getFullYear();
        return Array.from({ length: 12 }, (_, i) => {
            const monthDate = new Date(currentYear, i, 1);
            return {
                value: monthDate.toISOString(),
                label: monthDate.toLocaleString('default', { month: 'long', year: 'numeric' }),
            };
        });
    };

    const filteredMonthlyData = selectedMonth
        ? monthlyData.filter(data => new Date(data.month).getMonth() === new Date(selectedMonth).getMonth())
        : monthlyData;

    const monthlyChartData = filteredMonthlyData.length > 0
        ? {
            labels: filteredMonthlyData.map(data => new Date(data.month).toLocaleString('default', { month: 'long', year: 'numeric' })),
            datasets: [
                {
                    data: filteredMonthlyData.map(data => data.total),
                    backgroundColor: ['#FF6384', '#FB87FC', '#FFCE56', '#4BC0C0', '#9966FF', '#FF9F40'],
                },
            ],
        }
        : {
            labels: ['No Data'],
            datasets: [
                {
                    data: [1],  // Just a single slice for 'No Data'
                    backgroundColor: ['#D3D3D3'],  // Gray color
                },
            ],
        };

    const dailyChartData = {
        labels: filteredDailyData.map(data => `Day ${data.day}`),
        datasets: [
            {
                type: 'bar',
                label: 'Total',
                data: filteredDailyData.map(data => data.total),
                backgroundColor: '#61ED44',
                order: 1,
            },
            {
                type: 'line',
                label: 'Trend Line',
                data: filteredDailyData.map(data => data.total),
                borderColor: '#FF6384',
                borderWidth: 2,
                fill: false,
                tension: 0.2,
                pointBackgroundColor: '#FF6384',
                pointBorderColor: '#FF6384',
                pointRadius: 4,
                order: 2,
            },
        ],
    };

    if (loading) {
        return (
            <div className={styles.loadingContainer}>
                {'Loading...'.split('').map((letter, index) => (
                    <span key={index} className={styles.loadingLetter} style={{ '--index': index }}>
                        {letter}
                    </span>
                ))}
            </div>
        );
    }

    return (
        <div className={styles.container}>
            <div className={styles.header}>
                <h2>Monthly and Daily Summary</h2>
                <div className={styles.selectContainer}>
                    <label>Select Daily Summary by Month</label>
                    <select className={styles.selectDropdown} value={selectedMonth} onChange={handleMonthChange}>
                        <option value="">All Months</option>
                        {generateMonthOptions().map(month => (
                            <option key={month.value} value={month.value}>
                                {month.label}
                            </option>
                        ))}
                    </select>
                </div>
            </div>
            <div className={styles.chartRow}>
                <div className={styles.smallPieChart}>
                    <label style={{ marginBottom: '10px', textAlign: 'center', flexDirection: 'column' }}>Monthly Summary</label>
                    <Pie data={monthlyChartData} width={100} height={100} />
                </div>
                
                <div className={styles.chartContainer}>
                    <label style={{ marginBottom: '10px', textAlign: 'center', flexDirection: 'column' }}>Daily Summary with Trend Line</label>
                    <Bar 
                        data={dailyChartData} 
                        options={{ 
                            responsive: true, 
                            scales: { x: { beginAtZero: true } },
                            plugins: {
                                legend: { display: true },
                                tooltip: { mode: 'index', intersect: false }
                            }
                        }} 
                    />
                </div>
            </div>
        </div>
    );
};

export default SummaryCharts;
