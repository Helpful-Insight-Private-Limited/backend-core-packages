export const PRISMA_AUTH_SCHEMA_SNIPPET = `
model User {
  id              String         @id @default(uuid())
  email           String         @unique
  passwordHash    String?
  name            String?
  avatarUrl       String?
  isEmailVerified Boolean        @default(false)
  isMfaEnabled    Boolean        @default(false)
  mfaSecret       String?
  mfaBackupCodes  String?        // JSON array of strings
  googleId        String?        @unique
  githubId        String?        @unique
  refreshTokens   RefreshToken[]
  roles           UserRole[]
  createdAt       DateTime       @default(now())
  updatedAt       DateTime       @updatedAt
}

model RefreshToken {
  id         String   @id @default(uuid())
  token      String   @unique
  userId     String
  user       User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  deviceInfo String?
  isRevoked  Boolean  @default(false)
  expiresAt  DateTime
  createdAt  DateTime @default(now())
}
`;
