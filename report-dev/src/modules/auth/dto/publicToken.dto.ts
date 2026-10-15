import { checkSchema } from "express-validator";

export interface PublicTokenDto {
  fingerprint: string;
  ip?: string;
}

export const publicTokenDto = checkSchema({
  fingerprint: {
    isString: {
      errorMessage: "fingerprint must be a string",
    },
    isLength: {
      options: { min: 1 },
      errorMessage: "fingerprint must not be empty",
    },
  },
  ip: {
    isString: {
      errorMessage: "ip must be a string",
    },
    optional: true,
  },
});
