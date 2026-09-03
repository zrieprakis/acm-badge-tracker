import bcrypt from 'bcryptjs';
import { runMigrations } from './migrate.js';
import { adminUserRepository } from '../repositories/adminUserRepository.js';
import { teamMemberRepository } from '../repositories/teamMemberRepository.js';

const SAMPLE_TEAM_MEMBERS = [
  { displayName: 'Alex Rivera', acmCardholderId: 'CARD-1001' },
  { displayName: 'Jordan Lee', acmCardholderId: 'CARD-1002' },
  { displayName: 'Sam Patel', acmCardholderId: 'CARD-1003' },
];

async function seedAdminUser(): Promise<void> {
  const username = process.env.SEED_ADMIN_USERNAME;
  const password = process.env.SEED_ADMIN_PASSWORD;

  if (!username || !password) {
    console.log(
      'Skipping admin user seed: set SEED_ADMIN_USERNAME and SEED_ADMIN_PASSWORD env vars to create one.',
    );
    return;
  }

  const existing = await adminUserRepository.findByUsername(username);
  if (existing) {
    console.log(`Admin user "${username}" already exists, skipping.`);
    return;
  }

  const passwordHash = await bcrypt.hash(password, 12);
  await adminUserRepository.create(username, passwordHash);
  console.log(`Created admin user "${username}".`);
}

async function seedSampleTeamMembers(): Promise<void> {
  if (process.env.ACM_CLIENT_MODE !== 'mock') {
    console.log('ACM_CLIENT_MODE is not "mock" - skipping sample team member seed.');
    return;
  }

  const existing = await teamMemberRepository.findAll();
  if (existing.length > 0) {
    console.log(`${existing.length} team member(s) already exist, skipping sample seed.`);
    return;
  }

  for (const member of SAMPLE_TEAM_MEMBERS) {
    await teamMemberRepository.create(member);
  }
  console.log(`Created ${SAMPLE_TEAM_MEMBERS.length} sample team members.`);
}

async function main() {
  await runMigrations();
  await seedAdminUser();
  await seedSampleTeamMembers();
}

main()
  .then(() => {
    console.log('Seed complete.');
    process.exit(0);
  })
  .catch((err) => {
    console.error('Seed failed:', err);
    process.exit(1);
  });
