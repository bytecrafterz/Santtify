-- PEDIDOS DE REPOSIÇÃO DE SENHA.
--
-- A irmã do cliente ficou sem entrar em 23/08 e ele só soube porque ela lhe
-- telefonou. A observação dele é a certa: se acontecesse a cem desconhecidos,
-- ninguém saberia — pareceria desinteresse, e era avaria.
--
-- A linha nasce mesmo quando o endereço não corresponde a conta nenhuma
-- (userId nulo). À pessoa responde-se sempre o mesmo, para o formulário não
-- servir para descobrir quem tem conta; e ao responsável interessa saber que
-- alguém tentou com um endereço que não existe.

CREATE TABLE "password_resets" (
    "id"          UUID NOT NULL,
    "userId"      UUID,
    "projectId"   UUID,
    "emailPedido" TEXT NOT NULL,
    "tokenHash"   TEXT,
    "expiresAt"   TIMESTAMP(3),
    "usedAt"      TIMESTAMP(3),
    "atendidoEm"  TIMESTAMP(3),
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "password_resets_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "password_resets_createdAt_idx" ON "password_resets"("createdAt");
CREATE INDEX "password_resets_userId_idx" ON "password_resets"("userId");

ALTER TABLE "password_resets" ADD CONSTRAINT "password_resets_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "password_resets" ADD CONSTRAINT "password_resets_projectId_fkey"
  FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;
