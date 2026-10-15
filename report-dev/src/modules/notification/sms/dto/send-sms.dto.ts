import { checkSchema } from "express-validator";

export interface SendSmsDto {
  to: string | string[];
  message: string;
  sender?: string;
  brandName?: string;
  templateCode?: string;
  templateParams?: Record<string, any>;
}

const phoneRegex = /^\+?[0-9]{8,15}$/;

export const sendSmsDto = checkSchema({
  to: {
    exists: {
      errorMessage: "to is required",
    },
    custom: {
      options: (value) => {
        const phoneNumbers = Array.isArray(value) ? value : [value];
        for (const phoneNumber of phoneNumbers) {
          if (typeof phoneNumber !== "string" || !phoneRegex.test(phoneNumber)) {
            throw new Error(`Invalid phone number: ${phoneNumber}`);
          }
        }
        return true;
      },
    },
  },
  message: {
    isString: {
      errorMessage: "message must be a string",
    },
    notEmpty: {
      errorMessage: "message cannot be empty",
    },
  },
  sender: {
    optional: true,
    isString: {
      errorMessage: "sender must be a string",
    },
  },
  brandName: {
    optional: true,
    isString: {
      errorMessage: "brandName must be a string",
    },
  },
  templateCode: {
    optional: true,
    isString: {
      errorMessage: "templateCode must be a string",
    },
  },
  templateParams: {
    optional: true,
    isObject: {
      errorMessage: "templateParams must be an object",
    },
  },
});
