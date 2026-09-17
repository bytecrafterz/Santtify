'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/components/ProvedorDeAuth'

/**
 * "MEU PERFIL" É O MEU PERFIL COMO OS OUTROS O VEEM.
 *
 * Esta página desenhava o cabeçalho novo do perfil e, por baixo dele, a página
 * de definições antiga inteira: um segundo avatar, o nome outra vez, a descrição
 * outra vez, quatro números de actividade, "Editar perfil" e "Sair da conta".
 * Era a mesma página que ele pediu para tirar em 25/08, e sobreviveu empilhada.
 *
 * Em 02/09 ele descreveu-a ("entro no perfil de outra pessoa e dali vou ao meu,
 * e encontro o desenho antigo") e eu mudei o link "O meu perfil" do cabeçalho
 * para o perfil visto de fora. Mudei esse caminho e deixei o da barra de baixo,
 * que continuava a dar à página antiga. Em 17/09, num navegador aberto a partir
 * do Gmail, ele tocou em "Meu Perfil" na barra e ela "voltou a aparecer".
 *
 * Agora os dois caminhos dão ao mesmo sítio. Editar e sair ficam no menu ⋮ do
 * próprio perfil, onde "Editar perfil" já estava.
 */
export function IrParaOMeuPerfil({ projectSlug }: { projectSlug: string }) {
  const router = useRouter()
  const { usuario, carregando } = useAuth()

  useEffect(() => {
    if (carregando) return
    if (!usuario) {
      router.replace(
        `/${projectSlug}/entrar?voltar=` + encodeURIComponent(`/${projectSlug}/perfil`),
      )
      return
    }
    router.replace(`/${projectSlug}/pessoa/${usuario.id}`)
  }, [usuario, carregando, router, projectSlug])

  return <p className="vazio">Carregando...</p>
}
