import { Controller, Get, Param, Query, Res, UseGuards } from '@nestjs/common'
import type { Response } from 'express'
import { AdminGuard, AuthGuard } from '../identity/auth.guard'
import { VendasService, type FiltroDePedidos } from './vendas.service'
import { enviarFolha } from './admin-afiliados.controller'
import { diaEmSaoPaulo } from './dinheiro'

/**
 * O painel de vendas: Pedidos, Clientes, Produtos, Financeiro, Relatórios — o
 * menu do mockup dele de 25/09. Só leitura; as acções que mexem em dinheiro
 * vivem no serviço dono delas (confirmar e reembolsar nos cartões, pagar um
 * afiliado nos afiliados).
 */
@Controller('admin/vendas')
@UseGuards(AuthGuard, AdminGuard)
export class AdminVendasController {
  constructor(private readonly vendas: VendasService) {}

  @Get('resumo')
  resumo(@Query('de') de?: string, @Query('ate') ate?: string) {
    return this.vendas.resumo(de, ate)
  }

  @Get('filtros')
  filtros() {
    return this.vendas.filtros()
  }

  @Get('pedidos')
  pedidos(@Query() q: Record<string, string | undefined>) {
    return this.vendas.pedidos(filtroDePedidos(q))
  }

  @Get('pedidos/exportar.csv')
  async exportarPedidos(@Query() q: Record<string, string | undefined>, @Res() res: Response) {
    const conteudo = await this.vendas.exportarPedidos(filtroDePedidos(q))
    enviarFolha(res, `pedidos-${diaEmSaoPaulo(new Date())}.csv`, conteudo)
  }

  @Get('pedidos/:id')
  pedido(@Param('id') id: string) {
    return this.vendas.pedido(id)
  }

  @Get('clientes')
  clientes(@Query('busca') busca?: string, @Query('pagina') pagina?: string) {
    return this.vendas.clientes({ busca, pagina: Number(pagina) || 1 })
  }

  @Get('clientes/detalhe')
  cliente(@Query('chave') chave = '') {
    return this.vendas.cliente(chave)
  }

  @Get('produtos')
  produtos(@Query('de') de?: string, @Query('ate') ate?: string) {
    return this.vendas.produtos(de, ate)
  }

  @Get('financeiro')
  financeiro(@Query('de') de?: string, @Query('ate') ate?: string) {
    return this.vendas.financeiro(de, ate)
  }

  @Get('financeiro/pagamentos.csv')
  async exportarPagamentos(@Query('de') de: string | undefined, @Query('ate') ate: string | undefined, @Res() res: Response) {
    const conteudo = await this.vendas.exportarPagamentos(de, ate)
    enviarFolha(res, `pagamentos-a-afiliados-${diaEmSaoPaulo(new Date())}.csv`, conteudo)
  }

  @Get('relatorios')
  relatorios(@Query('de') de?: string, @Query('ate') ate?: string) {
    return this.vendas.relatorios(de, ate)
  }
}

function filtroDePedidos(q: Record<string, string | undefined>): FiltroDePedidos {
  return {
    de: q.de,
    ate: q.ate,
    status: q.status,
    meio: q.meio,
    origem: q.origem,
    categoria: q.categoria,
    busca: q.busca,
    pagina: Number(q.pagina) || 1,
  }
}
