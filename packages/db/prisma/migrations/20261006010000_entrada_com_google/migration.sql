-- "Continuar com Google" (06/10).
ALTER TABLE "users"
  ADD COLUMN "googleId" VARCHAR(64),
  ADD COLUMN "semSenha" BOOLEAN NOT NULL DEFAULT false;

CREATE UNIQUE INDEX "users_googleId_key" ON "users"("googleId");
