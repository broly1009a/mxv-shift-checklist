import _ from "lodash";
import { Identity, HandlerError } from "@svl/share";
import { MongoQuery, PaginationService } from "@mss/common";
import ApprovalModel, { IApprovalDoc } from "../models/approval.model";
import { UpdateApprovalDto } from "./dto/updateApproval.dto";
import { ICreateApproval } from "./approval.interface";

export async function createApproval(appro: ICreateApproval) {
  switch (appro.action.toLowerCase()) {
    case "post":
      appro.action = Identity.Enums.ApprovalAction.CREATE;
      break;
    case "put":
      appro.action = Identity.Enums.ApprovalAction.UPDATE;
      break;
  }
  const approval = await ApprovalModel.create(appro);
  return approval;
}

export async function listApproval(query: MongoQuery) {
  const pagination = new PaginationService(ApprovalModel);
  if (!query.sort || Object.keys(query.sort).length === 0) {
    query.sort = {
      updatedAt: -1,
    };
  }
  const aggregateStages: any = [
    {
      $project: {
        approvalDate: 1,
        description: 1,
        status: 1,
        action: 1,
        createdAt: 1,
        updatedAt: 1,
        createdBy: 1,
        lastModifiedBy: 1,
      },
    },
  ];
  const list = await pagination.paginate(query, aggregateStages);

  return list;
}

export async function getApproval(id: string) {
  const approval = await ApprovalModel.findById(id).select("-version");
  if (!approval) {
    throw new HandlerError(`Approval ${id} not exist`);
  }
  const approvalJson = approval.toObject();
  const response = _.omit(approvalJson, [
    "collectionName",
    "oldValue",
    "pendingValue",
  ]);

  let valueChange = [];
  let pendingValue: any = approvalJson["pendingValue"];
  let add = {},
    sub = {};

  // handle visiable field in pendingValue
  const pendingValueJson = JSON.parse(pendingValue);
  if (pendingValueJson.invisible) {
    pendingValue = _.omit(pendingValueJson, [
      "invisible",
      ...pendingValueJson.invisible,
    ]);
    pendingValue = JSON.stringify(pendingValue);
  }

  if (approval.oldValue != "null") {
    const old = JSON.parse(approval.oldValue);
    pendingValue = Object.assign(
      JSON.parse(approval.oldValue),
      JSON.parse(pendingValue)
    );
    Object.keys(pendingValue).forEach((key) => {
      if (!_.isEqual(pendingValue[key], old[key])) {
        valueChange.push(key);
      }
    });

    pendingValue = JSON.stringify(pendingValue);
  }
  response["pendingData"] = {
    collectionName: approvalJson["collectionName"],
    oldValue: approvalJson["oldValue"],
    pendingValue: pendingValue,
    valueChange,
    add,
    sub,
  };
  return response;
}

export async function updateApproval(
  id: string,
  updateDto: UpdateApprovalDto,
  user: string
) {
  const approval = await ApprovalModel.findById(id);
  if (!approval) {
    throw new HandlerError(`Approval ${id} not exist`);
  }

  if (approval.status !== Identity.Enums.ApprovalStatus.PENDING) {
    throw new HandlerError(`Approval ${id} ${approval.status}`);
  }

  let data: any = {};
  switch (updateDto.status) {
    case Identity.Enums.ApprovalStatus.REJECTED:
      approval.status = updateDto.status;
      if (updateDto.rejectedReason)
        approval.rejectedReason = updateDto.rejectedReason;
      break;
    case Identity.Enums.ApprovalStatus.APPROVED:
      // Note: approval execution logic removed as per requirements
      approval.status = updateDto.status;
  }

  approval.approvalDate = Date.now();
  approval.lastModifiedBy = user;
  await approval.save();
  return { approval, data };
}
