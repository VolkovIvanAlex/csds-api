import { PrismaClient, UserRole } from '@prisma/client';
import axios from 'axios';
import https from 'https'; // 1. Import the 'https' module

// Initialize Prisma Client
const prisma = new PrismaClient();

// --- Configuration ---
const KEYROCK_URL = 'https://localhost:3443'; // 2. USE HTTPS and port 3443
const PEP_PROXY_URL = 'http://localhost:1027';
const ADMIN_EMAIL = 'admin@test.com';
const ADMIN_PASSWORD = '1234';
const APP_ID = '76a10506-0e0a-4132-928e-2e77e56fbb54';
const DEMO_EMAIL = 'volkov.ivan08.12@gmail.com';

// 3. Create an agent to bypass self-signed certificate errors
const httpsAgent = new https.Agent({
  rejectUnauthorized: false,
});


const fiwareHeaders = (authToken: string) => ({
  'X-Auth-Token': authToken,
  'Fiware-Service': 'csds',
  'Fiware-ServicePath': '/',
  'Content-Type': 'application/json',
});

const ngsiLdHeaders = (authToken: string) => ({
  ...fiwareHeaders(authToken),
  'Content-Type': 'application/ld+json',
});

async function main() {
  console.log('--- Starting Full Seeding Script for Keyrock & Prisma ---');

  /// --- Step 1: Login to Keyrock ---
  let adminToken: string;
  try {
    const response = await axios.post(
      `${KEYROCK_URL}/v1/auth/tokens`,
      { name: ADMIN_EMAIL, password: ADMIN_PASSWORD },
      { httpsAgent }
    );
    adminToken = response.headers['x-subject-token'];
    console.log('✅ Successfully logged into Keyrock as admin.');
  } catch (error) {
    console.error('❌ Failed to get Keyrock admin token. Aborting.', error.response?.data);
    return;
  }

// =================================================================
// --- Step 2: CLEANUP PREVIOUS RUN ---
// =================================================================
console.log('\n--- 🧹 Cleaning up data from previous run ---');

// --- Prisma Cleanup ---
try {
  await prisma.userOrganization.deleteMany({});
  await prisma.organization.deleteMany({});
  await prisma.user.deleteMany({});
  console.log('✅ Prisma: Database cleaned.');
} catch (e) {
    console.error('❌ Prisma: Failed to clean database.', e.message)
}

// --- Keyrock Cleanup ---
try {
  const perPageParam = '?per_page=100'; // Force API to return up to 100 items

  // Delete Users first
  try {
    const { data: { users = [] } } = await axios.get(`${KEYROCK_URL}/v1/users${perPageParam}`, { headers: { 'X-Auth-Token': adminToken }, httpsAgent });
    for (const user of users) {
        if (user.email && user.email.includes(DEMO_EMAIL)) {
            await axios.delete(`${KEYROCK_URL}/v1/users/${user.id}`, { headers: { 'X-Auth-Token': adminToken }, httpsAgent });
        }
    }
    console.log('✅ Keyrock: Users cleaned.');
  } catch(e) {
    console.error('❌ Keyrock: Could not clean users.', e.response?.data || e.message)
  }

  // Delete Organizations
  try {
    const { data: { organizations = [] } } = await axios.get(`${KEYROCK_URL}/v1/organizations${perPageParam}`, { headers: { 'X-Auth-Token': adminToken }, httpsAgent });
    for (const org of organizations) {
        await axios.delete(`${KEYROCK_URL}/v1/organizations/${org.id}`, { headers: { 'X-Auth-Token': adminToken }, httpsAgent });
    }
    console.log('✅ Keyrock: Organizations cleaned.');
  } catch(e) {
    // It's okay if this fails with a 404, as some orgs might be gone already
    if (e.response?.status !== 404) console.error('❌ Keyrock: Could not clean organizations.', e.response?.data)
    else console.log('✅ Keyrock: Organizations already clean.');
  }

  // Delete Application Roles
  try {
    const { data: { roles: appRoles = [] } } = await axios.get(`${KEYROCK_URL}/v1/applications/${APP_ID}/roles${perPageParam}`, { headers: { 'X-Auth-Token': adminToken }, httpsAgent });
     for (const role of appRoles) {
        await axios.delete(`${KEYROCK_URL}/v1/applications/${APP_ID}/roles/${role.id}`, { headers: { 'X-Auth-Token': adminToken }, httpsAgent });
    }
    console.log('✅ Keyrock: Roles cleaned.');
  } catch(e) {
    if (e.response?.status !== 404) console.error('❌ Keyrock: Could not clean roles.', e.response?.data)
    else console.log('✅ Keyrock: Roles already clean.');
  }

} catch (e) {
    console.error('❌ Keyrock: A critical error occurred during cleanup.', e.response?.data || e.message);
}

  // =================================================================
  // --- Step 3: Start Seeding New Data ---
  // =================================================================
  const systemFounder = await prisma.user.create({
    data: {
      privyId: `system-founder-${Date.now()}`,
      name: 'System Founder',
      email: `system-founder-${Date.now()}@system.local`,
      role: 'Admin',
      submissionQuatity: 0,
    },
  });
  console.log(`✅ Created 'System Founder' user in Prisma with ID: ${systemFounder.id}`);


  // --- Step 3: Create Roles in Keyrock ---
  console.log('\n--- Creating Roles in Keyrock ---');
  const roles = {};
  for (const roleName of ['GovBody', 'DataProvider', 'DataConsumer']) {
    try {
      const res = await axios.post(
        `${KEYROCK_URL}/v1/applications/${APP_ID}/roles`,
        { role: { name: roleName } },
        {
          headers: { 'X-Auth-Token': adminToken, 'Content-Type': 'application/json' },
          httpsAgent, // 4. Use the agent for this request
        }
      );
      roles[roleName] = res.data.role.id;
      console.log(`✅ Role '${roleName}' created in Keyrock.`);
    } catch (e) {
      console.error(`❌ Failed to create role ${roleName}:`, e.response?.data.error.message);
    }
  }

  // --- Step 4: Create Organizations and Users in Both Systems ---
  const orgsAndUsers = [
    { orgName: 'НБУ', user: { username: 'nbu_user', role: UserRole.GovBody } },
    { orgName: 'СБУ', user: { username: 'sbu_user', role: UserRole.GovBody } },
    { orgName: 'Банк1', user: { username: 'bank1_user', role: UserRole.DataProvider } },
    { orgName: 'Обленерго1', user: { username: 'oblenergo1_user', role: UserRole.DataProvider } },
    { orgName: 'Банк3', user: { username: 'bank3_user', role: UserRole.DataConsumer } },
    { orgName: 'IT Specialist', user: { username: 'it_specialist_user', role: UserRole.DataConsumer } },
  ];
  
  for (const item of orgsAndUsers) {
    console.log(`\n--- Processing: ${item.orgName} ---`);
    try {
      const [localPart, domain] = DEMO_EMAIL.split('@');
      const aliasedEmail = `${localPart}+${item.user.username}@${domain}`;
      console.log(`ℹ️  Using aliased email: ${aliasedEmail}`);

      // == Keyrock Part ==
      const orgRes = await axios.post(
        `${KEYROCK_URL}/v1/organizations`, 
        { organization: { name: item.orgName, description: `Organization for ${item.orgName}` } },
        {
          headers: { 'X-Auth-Token': adminToken, 'Content-Type': 'application/json' },
          httpsAgent, // 4. Use the agent for this request
        }
      );
      const orgId = orgRes.data.organization.id;
      console.log(`✅ Keyrock: Org '${item.orgName}' created.`);
      
      const userRes = await axios.post(
        `${KEYROCK_URL}/v1/users`,
        { user: { 
          username: item.user.username,
          email: aliasedEmail,
          password: 'defaultpassword',
          organization_id: orgId,
        }
       },
        {
          headers: { 'X-Auth-Token': adminToken, 'Content-Type': 'application/json' },
          httpsAgent, // 4. Use the agent for this request
        }
      );
      const userId = userRes.data.user.id;
      console.log(`✅ Keyrock: User '${item.user.username}' created.`);
      
      await axios.put(`${KEYROCK_URL}/v1/applications/${APP_ID}/users/${userId}/roles/${roles[item.user.role]}`, {}, { headers: { 'X-Auth-Token': adminToken }, httpsAgent });
      console.log(`✅ Keyrock: Assigned roles to user.`);

      // == Orion Part (This still uses HTTP as it's an internal call via PEP Proxy) ==
      // await axios.post(`${PEP_PROXY_URL}/ngsi-ld/v1/entities`, {
      //     id: `urn:ngsi-ld:Organization:${orgId}`, type: 'Organization', name: { type: 'Property', value: item.orgName }
      // }, { headers: ngsiLdHeaders(adminToken) });
      // console.log(`✅ Orion: Org '${item.orgName}' entity created.`);


      // == Prisma Part (remains the same) ==
      await prisma.organization.create({
        data: { id: orgId, name: item.orgName, founderId: systemFounder.id },
      });
      console.log(`✅ Prisma: Org '${item.orgName}' created.`);

      await prisma.user.create({
        data: { id: userId, privyId: `privy-${userId}`, name: item.user.username, email: aliasedEmail, role: item.user.role, submissionQuatity: 0, organizationId: orgId },
      });
      console.log(`✅ Prisma: User '${item.user.username}' created.`);

      await prisma.userOrganization.create({
        data: { userId: userId, organizationId: orgId },
      });
      console.log(`✅ Prisma: Linked user and organization.`);


    } catch (e) {
     console.error(`❌ Failed processing for ${item.orgName}:`);
      if (e.response) {
        // The request was made and the server responded with a status code
        // that falls out of the range of 2xx
        console.error('Error Data:', e.response.data);
        console.error('Error Status:', e.response.status);
      } else if (e.request) {
        // The request was made but no response was received
        console.error('Error Request:', e.request);
      } else {
        // Something happened in setting up the request that triggered an Error
        console.error('Error Message:', e.message);
      }
    }
  }

  console.log('\n--- Seeding Complete ---');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });