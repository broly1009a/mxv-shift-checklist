/**
 * Test Script Thẩm Định Cây Gia Phả Tác Vụ Động (Dynamic Tree Resolver)
 * 
 * Mục đích: Chứng minh TaskHierarchyHelper hoạt động 100% trơn tru với các Task ID sinh ngẫu nhiên (UUID/cuid)
 * mà không cần bất kỳ hardcoded Task ID hay suy diễn chuỗi '_s1', '_s2' nào.
 * 
 * Cách chạy:
 *   npx ts-node src/tests/test_task_hierarchy_dynamic.ts
 */

import { TaskHierarchyHelper, ITaskItem } from '../modules/checklist-hub/helpers/task-hierarchy.helper';

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ FAILED: ${message}`);
    process.exit(1);
  }
  console.log(` PASSED: ${message}`);
}

function runDynamicTreeTest() {
  console.log('================================================================');
  console.log('🧪 BẮT ĐẦU TEST CÂY GIA PHẢ TÁC VỤ ĐỘNG (UUID ZERO-HARDCODING)');
  console.log('================================================================\n');

  // 1. Giả lập ca trực với các UUID ngẫu nhiên hoàn toàn
  const parentId1 = 'c56a4180-65aa-42ec-a945-5fd21dec0538';
  const subId1_1 = '7f8a12b4-82a1-4cf1-9be3-c289a421b101';
  const subId1_2 = '1a2b3c4d-5e6f-7a8b-9c0d-1e2f3a4b5c6d';

  const parentId2 = '99999999-aaaa-bbbb-cccc-dddddddddddd';
  const subId2_1 = '88888888-1111-2222-3333-444444444444';

  const mockDetails: ITaskItem[] = [
    {
      taskId: parentId1,
      parentTaskIdSnapshot: null,
      taskName: 'Task Cha 1 (Đối chiếu phiên)',
      isChecked: false,
      status: 'PENDING',
    },
    {
      taskId: subId1_1,
      parentTaskIdSnapshot: parentId1,
      botCheckTypeSnapshot: 'CHECK_KLGD',
      taskName: 'Task Con 1.1 (Bot KLGD)',
      isChecked: true,
      status: 'COMPLETED',
    },
    {
      taskId: subId1_2,
      parentTaskIdSnapshot: parentId1,
      botCheckTypeSnapshot: 'CHECK_TTM',
      taskName: 'Task Con 1.2 (Bot TTM)',
      isChecked: true,
      status: 'COMPLETED',
    },
    {
      taskId: parentId2,
      parentTaskIdSnapshot: null,
      taskName: 'Task Cha 2 (Post EOD)',
      isChecked: false,
      status: 'PENDING',
    },
    {
      taskId: subId2_1,
      parentTaskIdSnapshot: parentId2,
      botCheckTypeSnapshot: 'CHECK_MARGIN',
      taskName: 'Task Con 2.1 (Quét Ký Quỹ Âm)',
      isChecked: false,
      status: 'PENDING',
    },
  ];

  // Test 1: Tìm Task Cha động qua parentTaskIdSnapshot
  const parentOfSub1 = TaskHierarchyHelper.findParentTask(subId1_1, mockDetails);
  assert(parentOfSub1?.taskId === parentId1, 'Tìm đúng Task Cha động từ Task Con UUID');

  // Test 2: Tìm các Task Con của Task Cha 1
  const subTasks1 = TaskHierarchyHelper.findSubTasks(parentId1, mockDetails);
  assert(subTasks1.length === 2, 'Tìm đúng 2 Task Con của Task Cha 1');
  assert(subTasks1.some((t) => t.taskId === subId1_1) && subTasks1.some((t) => t.taskId === subId1_2), 'Danh sách Task Con chứa đúng các UUID');

  // Test 3: Tìm Task Anh Em (Siblings)
  const siblings = TaskHierarchyHelper.getSiblings(subId1_1, mockDetails);
  assert(siblings.length === 1 && siblings[0].taskId === subId1_2, 'Tìm đúng 1 Task Anh Em cùng cha (loại trừ bản thân)');

  // Test 4: Lấy danh sách ID liên quan gia phả (getRelatedTaskIds)
  const relatedIdsFromSub = TaskHierarchyHelper.getRelatedTaskIds(subId1_1, mockDetails);
  assert(relatedIdsFromSub.includes(parentId1), 'Related IDs bao gồm Task Cha');
  assert(relatedIdsFromSub.includes(subId1_1), 'Related IDs bao gồm Bản thân');
  assert(relatedIdsFromSub.includes(subId1_2), 'Related IDs bao gồm Task Anh Em');
  assert(!relatedIdsFromSub.includes(parentId2), 'Related IDs không chứa ID của cây gia đình khác');

  // Test 5: Tìm cặp Bot Task theo năng lực (Capability Driven)
  const botPair = TaskHierarchyHelper.findBotTaskPair('CHECK_KLGD', mockDetails);
  assert(botPair.subTask?.taskId === subId1_1, 'Tìm đúng SubTask theo botCheckType "CHECK_KLGD"');
  assert(botPair.parentTask?.taskId === parentId1, 'Tìm đúng ParentTask đi kèm theo cây');

  // Test 6: Kiểm tra tất cả Task Con đã hoàn thành (isAllSubTasksCompleted)
  const isParent1Done = TaskHierarchyHelper.isAllSubTasksCompleted(parentId1, mockDetails);
  assert(isParent1Done === true, 'Task Cha 1 xác nhận tất cả Task Con đã hoàn thành');

  const isParent2Done = TaskHierarchyHelper.isAllSubTasksCompleted(parentId2, mockDetails);
  assert(isParent2Done === false, 'Task Cha 2 xác nhận Task Con chưa hoàn thành');

  // Test 7: Xây dựng Cây Phân Cấp (buildTaskTree)
  const tree = TaskHierarchyHelper.buildTaskTree(mockDetails);
  assert(tree.length === 2, 'Cây có đúng 2 nút gốc (Root Nodes)');
  assert(tree[0].children.length === 2, 'Nút gốc 1 có đúng 2 nút con');
  assert(tree[1].children.length === 1, 'Nút gốc 2 có đúng 1 nút con');

  console.log('\n================================================================');
  console.log('🎉 TOÀN BỘ 7 BÀI TEST THẨM ĐỊNH CÂY TÁC VỤ ĐỘNG ĐÃ PASS 100%!');
  console.log('================================================================\n');
}

runDynamicTreeTest();
