-- מבט זוגי (מסך משפחה): תפקיד התיק — ראשי או בן/בת זוג
CREATE TYPE "ClientRole" AS ENUM ('PRIMARY', 'SPOUSE');

ALTER TABLE "Client" ADD COLUMN "role" "ClientRole" NOT NULL DEFAULT 'PRIMARY';

CREATE UNIQUE INDEX "Client_userId_role_key" ON "Client"("userId", "role");
