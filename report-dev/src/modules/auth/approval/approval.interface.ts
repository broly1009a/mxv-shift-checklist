export interface ICreateApproval {
  apiUrl: string;
  collectionName: string;
  documentId: string;
  description?: string;
  action: string;
  oldValue: string;
  pendingValue: string;
  createdBy: string;
  tags: string;
}
