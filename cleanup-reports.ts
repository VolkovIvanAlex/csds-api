import axios from 'axios';

const ORION_URL = 'http://localhost:1026';
const FIWARE_HEADERS = {
  'Fiware-Service': 'csds',
  'Fiware-ServicePath': '/',
};

async function deleteAllReports() {
  try {
    console.log('Fetching all reports from the Context Broker...');
    
    // 1. Get all entities of type "Report"
    const response = await axios.get(`${ORION_URL}/ngsi-ld/v1/entities`, {
      headers: { ...FIWARE_HEADERS, 'Accept': 'application/ld+json' },
      params: {
        type: 'Report',
        limit: 1000, // Get up to 1000 reports
      },
    });

    const reports = response.data;

    if (reports.length === 0) {
      console.log('✅ No reports to delete.');
      return;
    }

    console.log(`Found ${reports.length} reports. Deleting now...`);

    // 2. Loop through and delete each report
    for (const report of reports) {
      const reportId = report.id;
      await axios.delete(`${ORION_URL}/ngsi-ld/v1/entities/${reportId}`, {
        headers: FIWARE_HEADERS,
      });
      console.log(`- Deleted: ${reportId}`);
    }

    console.log('✅ All reports have been deleted.');
  } catch (error) {
    console.error('Error during cleanup:', error.response ? error.response.data : error.message);
  }
}

deleteAllReports();