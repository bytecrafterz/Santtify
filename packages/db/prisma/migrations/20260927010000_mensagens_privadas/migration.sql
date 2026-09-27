-- CreateTable
CREATE TABLE "conversas_privadas" (
    "id" UUID NOT NULL,
    "userAId" UUID NOT NULL,
    "userBId" UUID NOT NULL,
    "lidaPorAEm" TIMESTAMP(3),
    "lidaPorBEm" TIMESTAMP(3),
    "criadaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ultimaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "conversas_privadas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mensagens_privadas" (
    "id" UUID NOT NULL,
    "conversaId" UUID NOT NULL,
    "autorId" UUID NOT NULL,
    "texto" TEXT NOT NULL,
    "criadaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mensagens_privadas_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "conversas_privadas_userAId_ultimaEm_idx" ON "conversas_privadas"("userAId", "ultimaEm");

-- CreateIndex
CREATE INDEX "conversas_privadas_userBId_ultimaEm_idx" ON "conversas_privadas"("userBId", "ultimaEm");

-- CreateIndex
CREATE UNIQUE INDEX "conversas_privadas_userAId_userBId_key" ON "conversas_privadas"("userAId", "userBId");

-- CreateIndex
CREATE INDEX "mensagens_privadas_conversaId_criadaEm_idx" ON "mensagens_privadas"("conversaId", "criadaEm");

-- AddForeignKey
ALTER TABLE "conversas_privadas" ADD CONSTRAINT "conversas_privadas_userAId_fkey" FOREIGN KEY ("userAId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversas_privadas" ADD CONSTRAINT "conversas_privadas_userBId_fkey" FOREIGN KEY ("userBId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mensagens_privadas" ADD CONSTRAINT "mensagens_privadas_conversaId_fkey" FOREIGN KEY ("conversaId") REFERENCES "conversas_privadas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mensagens_privadas" ADD CONSTRAINT "mensagens_privadas_autorId_fkey" FOREIGN KEY ("autorId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

