import { checkSchema } from "express-validator";

export interface SendMailDto {
  to: string | string[];
  cc?: string | string[];
  bcc?: string | string[];
  subject: string;
  html: string;
}

export const sendMailDto = checkSchema({
  to: {
    exists: {
      errorMessage: "to is required",
    },
    custom: {
      options: (value) => {
        const emails = Array.isArray(value) ? value : [value];
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        for (const email of emails) {
          if (!emailRegex.test(email)) {
            throw new Error(`Invalid email address: ${email}`);
          }
        }
        return true;
      },
    },
  },
  cc: {
    optional: true,
    custom: {
      options: (value) => {
        if (!value) return true;
        const emails = Array.isArray(value) ? value : [value];
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        for (const email of emails) {
          if (!emailRegex.test(email)) {
            throw new Error(`Invalid email address: ${email}`);
          }
        }
        return true;
      },
    },
  },
  bcc: {
    optional: true,
    custom: {
      options: (value) => {
        if (!value) return true;
        const emails = Array.isArray(value) ? value : [value];
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        for (const email of emails) {
          if (!emailRegex.test(email)) {
            throw new Error(`Invalid email address: ${email}`);
          }
        }
        return true;
      },
    },
  },
  subject: {
    isString: {
      errorMessage: "subject must be a string",
    },
    notEmpty: {
      errorMessage: "subject cannot be empty",
    },
  },
  html: {
    isString: {
      errorMessage: "html must be a string",
    },
    notEmpty: {
      errorMessage: "html cannot be empty",
    },
  },
});
