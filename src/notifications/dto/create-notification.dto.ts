export type CreateNotificationInput = {
  userId: string;
  title: string;
  message: string;
  type?: string;
  applicationId?: string | null;
  applicationNumber?: string | null;
  linkPath?: string | null;
  createdBy?: string | null;
};
