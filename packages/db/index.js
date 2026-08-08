/**
 * Ponto único de importação do cliente Prisma para os apps.
 * Re-exporta @prisma/client para que os apps não dependam dele diretamente —
 * se um dia trocarmos de ORM, o ponto de troca é este arquivo.
 */
module.exports = require('@prisma/client')
