import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { MarginChangeRequestsService } from './modules/margin-change-requests/margin-change-requests.service';
import { getModelToken } from '@nestjs/mongoose';
import { User } from './schemas/user.schema';
import { MarginChangeRequest } from './schemas/margin-change-request.schema';
import { BadRequestException, ForbiddenException } from '@nestjs/common';

async function runMakerCheckerTests() {
  console.log('Booting NestJS application context for Maker-Checker testing...');
  const app = await NestFactory.createApplicationContext(AppModule);

  const requestsService = app.get(MarginChangeRequestsService);
  const userModel = app.get<any>(getModelToken(User.name));
  const requestModel = app.get<any>(getModelToken(MarginChangeRequest.name));

  console.log('Fetching users for testing...');
  const adminUser = await userModel.findOne({ username: 'admin' }).exec();
  const staffUser = await userModel.findOne({ username: 'sonhh' }).exec();

  if (!adminUser || !staffUser) {
    throw new Error('Required test users (admin and sonhh) not found in database!');
  }

  console.log('Cleaning up old margin change requests...');
  await requestModel.deleteMany({}).exec();

  let reqId = '';

  try {
    // 1. Creation Test
    console.log('Test 1: Creating a Margin Change Request as Staff (sonhh)...');
    const req = await requestsService.createRequest(
      {
        commodity: 'WTI Crude Oil',
        oldMargin: 7000,
        newMargin: 6500,
        effectiveSession: 'Phiên Mỹ 24/06/2026',
        comments: 'Điều chỉnh ký quỹ theo quyết định của Sở GD hàng hóa',
      },
      staffUser,
    );

    reqId = req._id.toString();
    if (req.status === 'PENDING_APPROVAL' && req.commodity === 'WTI Crude Oil') {
      console.log('✅ Test 1 PASSED: Request successfully created with PENDING_APPROVAL status.');
    } else {
      throw new Error('Test 1 FAILED: Unexpected request details: ' + JSON.stringify(req));
    }

    // 2. Maker-Checker Self-Approval Constraint Test
    console.log('Test 2: Attempting self-approval as Maker (sonhh)...');
    try {
      await requestsService.approveRequest(reqId, staffUser);
      throw new Error('Test 2 FAILED: Allowed self-approval!');
    } catch (err) {
      if (err instanceof BadRequestException) {
        console.log('✅ Test 2 PASSED: Self-approval correctly blocked. Error message:', err.message);
      } else {
        throw err;
      }
    }

    // 3. Checker Role Constraint Test
    // Let's modify staffUser to ensure we test role checks. First let's create a request made by Admin,
    // and try to approve it using Staff. Staff user has role 'STAFF' which is not in approved checker list.
    console.log('Test 3: Creating request by Admin, then attempting approval by Staff (sonhh)...');
    const adminReq = await requestsService.createRequest(
      {
        commodity: 'LME Copper',
        oldMargin: 12000,
        newMargin: 11500,
        effectiveSession: 'Phiên London 24/06/2026',
      },
      adminUser,
    );

    try {
      await requestsService.approveRequest(adminReq._id.toString(), staffUser);
      throw new Error('Test 3 FAILED: Staff was allowed to approve requests!');
    } catch (err) {
      if (err instanceof ForbiddenException) {
        console.log('✅ Test 3 PASSED: Non-approver approval correctly blocked. Error message:', err.message);
      } else {
        throw err;
      }
    }

    // 4. Success Approval Flow
    console.log('Test 4: Approving Staff-created request by Admin...');
    const approvedReq = await requestsService.approveRequest(reqId, adminUser, 'Đã đối chiếu, phê duyệt.');
    if (approvedReq.status === 'APPROVED' && approvedReq.approvedBy?.toString() === adminUser._id.toString()) {
      console.log('✅ Test 4 PASSED: Request successfully approved by Checker (admin).');
    } else {
      throw new Error('Test 4 FAILED: Approved status not updated properly: ' + JSON.stringify(approvedReq));
    }

    // 5. Success Rejection Flow
    console.log('Test 5: Creating another request by Staff, then rejecting it as Admin...');
    const req2 = await requestsService.createRequest(
      {
        commodity: 'Natural Gas',
        oldMargin: 3000,
        newMargin: 2800,
        effectiveSession: 'Phiên Mỹ 24/06/2026',
      },
      staffUser,
    );

    const rejectedReq = await requestsService.rejectRequest(
      req2._id.toString(),
      adminUser,
      'Sai biên độ ký quỹ tối đa cho phép',
    );

    if (rejectedReq.status === 'REJECTED' && rejectedReq.rejectionReason === 'Sai biên độ ký quỹ tối đa cho phép') {
      console.log('✅ Test 5 PASSED: Request successfully rejected with reason.');
    } else {
      throw new Error('Test 5 FAILED: Rejection not updated properly: ' + JSON.stringify(rejectedReq));
    }

  } finally {
    console.log('Cleaning up test data...');
    await requestModel.deleteMany({}).exec();
  }

  console.log('\n🎉 ALL MAKER-CHECKER TESTS PASSED SUCCESSFULLY!');
  await app.close();
}

runMakerCheckerTests().catch((err) => {
  console.error('❌ Test execution failed with error:', err);
  process.exit(1);
});
