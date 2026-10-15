import { Notification } from '@svl/share';

/**
 * Mock MailHistoryModel for testing without MongoDB
 */
export class MockMailHistoryModel {
  static _histories: any[] = [];

  static async create(data: any) {
    const history = {
      _id: Math.random().toString(36).substring(7),
      ...data,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this._histories.push(history);
    return history;
  }

  static clear() {
    this._histories = [];
  }

  static getAll() {
    return this._histories;
  }
}

/**
 * Mock nodemailer transporter
 */
export function createMockTransporter() {
  return {
    sendMail: jest.fn().mockResolvedValue({ messageId: 'mock-message-id' }),
    verify: jest.fn().mockResolvedValue(true),
    close: jest.fn(),
  };
}

/**
 * Mock SMS service module
 */
export const mockSmsService = {
  sendSmsMessage: jest.fn().mockResolvedValue(undefined),
};

/**
 * Mock Teams service module
 */
export const mockTeamsService = {
  sendTeamsMessage: jest.fn().mockResolvedValue(undefined),
};

/**
 * Mock Zalo service module
 */
export const mockZaloService = {
  sendZaloMessage: jest.fn().mockResolvedValue(undefined),
};

/**
 * Mock WS service functions
 */
export const mockWsService = {
  direct: jest.fn(),
  broadcast: jest.fn(),
  sendWsMessage: jest.fn().mockResolvedValue(undefined),
};

/**
 * Mock clientManager for WS
 */
export const mockClientManager = new Map();

export function createMockLogger() {
  return {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  };
}
