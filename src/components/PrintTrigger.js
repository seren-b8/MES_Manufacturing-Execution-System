import { useEffect } from 'react';

const sendPrintRequest = (labelData) => {
  fetch('http://10.1.8.163:5000/printtest', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(labelData),
  })
    .then(response => response.json())
    .then(data => {
      console.log('Success:', data);
    })
    .catch((error) => {
      console.error('Error:', error);
    });
};

const PrintTrigger = () => {
  useEffect(() => {
    const handleKeyPress = (event) => {
      if (event.key === '1') {
        const labelData = {
          label: '001',
          description: 'Sample Label 1'
        };
        sendPrintRequest(labelData);
      }
    };

    window.addEventListener('keypress', handleKeyPress);
    return () => {
      window.removeEventListener('keypress', handleKeyPress);
    };
  }, []);

  return null;
};

export default PrintTrigger;
