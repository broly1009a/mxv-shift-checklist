import { Identity } from "@svl/share";
import { checkSchema } from "express-validator";

export interface UpdateApprovalDto {
  status: Identity.Enums.ApprovalStatus;
  rejectedReason?: string;
  lastModifiedBy: string;
}

export const updateApprovalDto = checkSchema({
  status: {
    isString: true,
    isIn: {
      options: [
        [
          Identity.Enums.ApprovalStatus.APPROVED,
          Identity.Enums.ApprovalStatus.PENDING,
          Identity.Enums.ApprovalStatus.REJECTED,
        ],
      ],
      errorMessage: "status invalid",
    },
  },
  rejectedReason: {
    isString: {
      errorMessage: "rejectedReason must be a string",
    },
    optional: true,
  },
  lastModifiedBy: {
    isString: {
      errorMessage: "lastModifiedBy must be a string",
    },
  },
});
