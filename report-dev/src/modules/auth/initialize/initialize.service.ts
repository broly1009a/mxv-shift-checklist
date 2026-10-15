import _ from "lodash";
import UserModel from "../models/user.model";
import GroupRoleModel from "../models/groupRole.model";
import { Identity } from "@svl/share";

export async function initAuthSeed() {
  const adminData = {
    username: "admin",
    email: "admin2025@mxv.vn",
    fullname: "admin",
    password: "Mxv@2025",
    PIN: "123456",
    phoneNumber: "0123456789",
    requireChangePassword: false,
    requirePIN: true,
    role: _.without(Object.values(Identity.Enums.Permission), Identity.Enums.Permission.SUPER_ADMIN),
    type: Identity.Enums.UserType.USER,
    status: Identity.Enums.UserStatus.ACTIVE,
    createdBy: "system",
  };

  const itAdminData = {
    username: "itadmin",
    email: "itadmin2025@mxv.vn",
    fullname: "admin",
    password: "Mxv@2025",
    PIN: "123456",
    phoneNumber: "0123456789",
    requireChangePassword: false,
    requirePIN: true,
    role: [Identity.Enums.Permission.SUPER_ADMIN],
    type: Identity.Enums.UserType.SUPER_ADMIN,
    status: Identity.Enums.UserStatus.ACTIVE,
    createdBy: "system",
  };

  const admin = await UserModel.findOne({ username: adminData.username });
  const itadmin = await UserModel.findOne({ username: itAdminData.username });

  if (!admin) {
    await UserModel.create(adminData);
  }

  if (!itadmin) {
    await UserModel.create(itAdminData);
  }

  const bulkOps = Object.values(Identity.Enums.GroupRoleCode).map((code) => ({
    updateOne: {
      filter: { name: code },
      update: {
        $setOnInsert: {
          name: code,
          description: code,
          createdBy: "system",
          lastModifiedBy: "system",
        },
      },
      upsert: true,
    },
  }));

  await GroupRoleModel.bulkWrite(bulkOps);
}
