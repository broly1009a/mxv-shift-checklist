import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { AuthService } from './modules/auth/auth.service';
import { getModelToken } from '@nestjs/mongoose';
import { User } from './schemas/user.schema';

async function run() {
  console.log('----------------------------------------------------');
  console.log('🚀 TESTING SSO AUTO-ONBOARD ROLE ASSIGNMENT SCRIPT');
  console.log('----------------------------------------------------');
  console.log('Booting NestJS application context...');
  const app = await NestFactory.createApplicationContext(AppModule);

  const authService = app.get(AuthService);
  const userModel = app.get<any>(getModelToken(User.name));

  const testEmail = 'director.trade@mxv.vn';
  const testUsername = 'director.trade';

  console.log(
    `\n🧹 Cleaning up any existing test user for username: ${testUsername}...`,
  );
  await userModel.deleteOne({ username: testUsername }).exec();

  console.log(
    `\n🔑 Simulating first-time Microsoft SSO for email: ${testEmail}...`,
  );
  try {
    const user = await authService.validateMicrosoftSSO(
      testEmail,
      'Giám đốc Khối QLGD',
    );

    console.log('\n✅ SSO Auto-Onboard Succeeded!');
    console.log('----------------------------------------------------');
    console.log(`Username:       ${user.username}`);
    console.log(`Full Name:      ${user.fullName}`);
    console.log(`Role Assigned:  ${user.role} (Expected: DIVISION_DIRECTOR)`);
    console.log(`Is Active:      ${user.isActive} (Expected: true)`);
    console.log(
      `Division ID:    ${user.divisionId ? user.divisionId.name || user.divisionId._id || user.divisionId : 'null'}`,
    );
    console.log(
      `Department ID:  ${user.departmentId ? user.departmentId.name || user.departmentId._id || user.departmentId : 'null'}`,
    );
    console.log('----------------------------------------------------');

    // Verification asserts
    if (user.role !== 'DIVISION_DIRECTOR') {
      console.error('❌ FAIL: Role was not mapped to DIVISION_DIRECTOR');
    } else if (user.isActive !== true) {
      console.error('❌ FAIL: User is not active');
    } else if (!user.divisionId) {
      console.error('❌ FAIL: divisionId was not populated/assigned');
    } else {
      console.log('🎉 ALL ASSERTS PASSED SUCCESSFULLY!');
    }
  } catch (err) {
    console.error('❌ Test failed with error:', err);
  } finally {
    // Clean up
    console.log(`\n🧹 Post-test cleaning up user: ${testUsername}...`);
    await userModel.deleteOne({ username: testUsername }).exec();
    await app.close();
    console.log('Done.');
  }
}

run().catch((err) => {
  console.error('Failed:', err);
  process.exit(1);
});
