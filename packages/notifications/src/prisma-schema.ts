export const PRISMA_NOTIFICATION_SCHEMA_SNIPPET = `
model Notification {
  id        String    @id @default(uuid())
  userId    String
  category  String    @default("system")
  title     String
  message   String
  data      String?   // JSON object string
  isRead    Boolean   @default(false)
  readAt    DateTime?
  createdAt DateTime  @default(now())

  @@index([userId, isRead])
}

model NotificationPreference {
  id        String   @id @default(uuid())
  userId    String
  category  String
  channel   String
  enabled   Boolean  @default(true)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@unique([userId, category, channel])
}
`;
