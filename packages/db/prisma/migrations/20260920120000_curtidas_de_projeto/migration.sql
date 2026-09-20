-- CreateTable
CREATE TABLE "reacoes_de_projeto" (
    "id" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "type" "ReactionType" NOT NULL DEFAULT 'LIKE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reacoes_de_projeto_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "reacoes_de_projeto_projectId_idx" ON "reacoes_de_projeto"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "reacoes_de_projeto_projectId_userId_type_key" ON "reacoes_de_projeto"("projectId", "userId", "type");

-- AddForeignKey
ALTER TABLE "reacoes_de_projeto" ADD CONSTRAINT "reacoes_de_projeto_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reacoes_de_projeto" ADD CONSTRAINT "reacoes_de_projeto_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

