'use client'

import { rastrear } from '@/lib/track'

/**
 * O botão que leva ao grupo do Produto Vivo.
 *
 * Era o WhatsApp pessoal do cliente até 15/08. Ele trocou por um grupo oficial
 * para não repetir a mesma explicação para cada interessado — e o efeito
 * colateral é bom: o telefone dele deixa de ficar publicado numa página aberta.
 *
 * O clique é registrado à parte do clique no selo PV. Abrir a página é
 * curiosidade; pedir para entrar no grupo é intenção. É a segunda contagem que
 * responde a pergunta comercial dele: existem dez, vinte ou cinquenta empresas?
 */
export function EntrarNoGrupoPv({ projectId, url }: { projectId: string; url: string }) {
  return (
    <a
      className="botao-whatsapp"
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      onClick={() => void rastrear({ projectId, type: 'PV_CONTACT' })}
    >
      Entrar no grupo do Produto Vivo
    </a>
  )
}
