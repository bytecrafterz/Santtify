/**
 * Os e-mails do programa de afiliados.
 *
 * O mesmo desenho do e-mail de repor a senha, para a Santtify falar sempre com
 * a mesma voz — e no português de quem os lê, que é o do Brasil, como nos
 * mockups do cliente ("compartilhar seu link"). Saem só quando há serviço de
 * e-mail configurado; sem ele, o painel do afiliado e o do administrador
 * mostram o mesmo, e nada se perde.
 */

function escapar(texto: string): string {
  return texto
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

interface Mensagem {
  assunto: string
  texto: string
  html: string
}

function primeiroNome(nome: string): string {
  return nome.trim().split(/\s+/)[0] || 'Olá'
}

function envelope(titulo: string, paragrafos: string[], botao?: { texto: string; url: string }): string {
  const corpo = paragrafos
    .map((p) => `<p style="margin:0 0 16px;font-size:15px;line-height:1.5">${p}</p>`)
    .join('\n      ')
  const acao = botao
    ? `<p style="margin:4px 0 0">
        <a href="${escapar(botao.url)}" style="display:inline-block;background:#16a34a;color:#ffffff;text-decoration:none;font-weight:700;padding:14px 22px;border-radius:999px">${escapar(botao.texto)}</a>
      </p>`
    : ''
  return `<!doctype html>
<html lang="pt-BR"><body style="margin:0;padding:24px;background:#f6f7fb;font-family:-apple-system,Segoe UI,Roboto,sans-serif;color:#171a22">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:16px;padding:28px">
    <tr><td>
      <h1 style="margin:0 0 12px;font-size:20px">${escapar(titulo)}</h1>
      ${corpo}
      ${acao}
    </td></tr>
  </table>
</body></html>`
}

export function emailDeAreaLiberada(d: { nome: string; link: string; painel: string; comissao: string }): Mensagem {
  const nome = primeiroNome(d.nome)
  return {
    assunto: 'Sua área de afiliado foi liberada — Santtify',
    texto:
      `${nome}, obrigado pela sua compra!\n\n` +
      `Sua área de afiliado está liberada. Compartilhe seu link e ganhe ${d.comissao} de cada compra feita por ele:\n${d.link}\n\n` +
      `Acompanhe os cliques, as vendas e as comissões no seu perfil:\n${d.painel}`,
    html: envelope(
      'Sua área de afiliado foi liberada',
      [
        `${escapar(nome)}, obrigado pela sua compra!`,
        `Compartilhe seu link e ganhe <strong>${escapar(d.comissao)}</strong> de cada compra feita por ele:`,
        `<span style="word-break:break-all;font-weight:700">${escapar(d.link)}</span>`,
        'Os cliques, as vendas e as comissões aparecem sozinhos no seu perfil.',
      ],
      { texto: 'VER MINHA ÁREA', url: d.painel },
    ),
  }
}

export function emailDeNovaVenda(d: { nome: string; comissao: string; dias: number; painel: string }): Mensagem {
  const nome = primeiroNome(d.nome)
  const prazo =
    d.dias > 0 ? `Ela fica disponível em ${d.dias} dia${d.dias === 1 ? '' : 's'}.` : 'Ela já está disponível.'
  return {
    assunto: `Nova venda pelo seu link: ${d.comissao} de comissão`,
    texto: `${nome}, alguém comprou pelo seu link!\n\nSua comissão é de ${d.comissao}. ${prazo}\n\n${d.painel}`,
    html: envelope(
      'Nova venda pelo seu link',
      [
        `${escapar(nome)}, alguém comprou pelo seu link!`,
        `Sua comissão é de <strong>${escapar(d.comissao)}</strong>. ${escapar(prazo)}`,
      ],
      { texto: 'VER MINHAS VENDAS', url: d.painel },
    ),
  }
}

export function emailDeComissaoDisponivel(d: { nome: string; valor: string; saldo: string; painel: string }): Mensagem {
  const nome = primeiroNome(d.nome)
  return {
    assunto: `${d.valor} de comissão ficou disponível`,
    texto:
      `${nome}, ${d.valor} das suas comissões passou para o saldo disponível.\n\n` +
      `Seu saldo disponível é de ${d.saldo}. Confira sua chave Pix no painel para receber:\n${d.painel}`,
    html: envelope(
      'Comissão disponível',
      [
        `${escapar(nome)}, <strong>${escapar(d.valor)}</strong> das suas comissões passou para o saldo disponível.`,
        `Seu saldo disponível é de <strong>${escapar(d.saldo)}</strong>. Confira sua chave Pix no painel para receber.`,
      ],
      { texto: 'VER MEU SALDO', url: d.painel },
    ),
  }
}

export function emailDePagamentoFeito(d: { nome: string; valor: string; chave: string | null; painel: string }): Mensagem {
  const nome = primeiroNome(d.nome)
  const para = d.chave ? ` para a chave Pix ${d.chave}` : ''
  return {
    assunto: `Pagamento de comissões: ${d.valor}`,
    texto: `${nome}, enviamos ${d.valor} das suas comissões${para}.\n\nOs detalhes estão no seu painel:\n${d.painel}`,
    html: envelope(
      'Pagamento de comissões',
      [`${escapar(nome)}, enviamos <strong>${escapar(d.valor)}</strong> das suas comissões${escapar(para)}.`],
      { texto: 'VER MEU PAINEL', url: d.painel },
    ),
  }
}

export function emailDeLembreteDePagamentos(d: {
  quantos: number
  total: string
  linhas: string[]
  painel: string
}): Mensagem {
  const plural = d.quantos === 1 ? '' : 's'
  return {
    assunto: `Pagamentos de afiliados: ${d.quantos} a pagar (${d.total})`,
    texto:
      `Há ${d.quantos} afiliado${plural} com saldo para receber, num total de ${d.total}.\n\n` +
      `${d.linhas.join('\n')}\n\nPague pelo Pix e marque como pago no painel:\n${d.painel}`,
    html: envelope(
      'Pagamentos de afiliados',
      [
        `Há <strong>${d.quantos}</strong> afiliado${plural} com saldo para receber, num total de <strong>${escapar(d.total)}</strong>.`,
        d.linhas.map(escapar).join('<br>'),
        'Pague pelo Pix e marque como pago no painel.',
      ],
      { texto: 'ABRIR O PAINEL', url: d.painel },
    ),
  }
}
