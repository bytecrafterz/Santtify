"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { DecoracaoPastel } from "@/components/DecoracaoPastel";

/**
 * A folha de instalação, sobre a tela de entrada — o desenho que ele mandou
 * em 22/08 e sobre o qual escreveu "quero exatamente este design".
 *
 * A regra que ele deu é toda sobre NÃO SAIR DA PÁGINA: a instalação aparece
 * por cima, o cadastro fica por baixo, e depois de instalar a folha desaparece
 * e o cadastro continua ali. Por isso isto é uma folha sobreposta e não outra
 * tela: quem instala não perde o que estava a fazer, e quem não quer instalar
 * afasta-a e continua.
 *
 * SOBRE O BOTÃO VERDE. Ele só abre a caixa do Android quando o navegador nos
 * avisou antes que a instalação é possível (`beforeinstallprompt`), e esse
 * aviso não vem sempre: não vem no iPhone, não vem se a aplicação já estiver
 * instalada, e no Android pode demorar. A tentação era esconder o botão nesses
 * casos. Não escondo: um botão que aparece e desaparece obriga a pessoa a
 * adivinhar. O botão está sempre, e quando não há caixa do Android para abrir
 * ele abre, aqui dentro, o caminho manual daquele telemóvel. Nunca é um botão
 * morto — foi exactamente isso que já nos custou uma queixa neste projecto.
 */
type Aviso = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

type Estado = "convite" | "instrucoes" | "fechada" | "instalado";

const CHAVE = "pv_folha_instalar_fechada";

export function FolhaDeInstalacao() {
  const [estado, definirEstado] = useState<Estado>("convite");
  const [pronta, definirPronta] = useState(false);
  const [ehIphone, definirEhIphone] = useState(false);
  const [abrindo, definirAbrindo] = useState(false);
  const aviso = useRef<Aviso | null>(null);

  useEffect(() => {
    const ua = window.navigator.userAgent;
    definirEhIphone(/iPad|iPhone|iPod/.test(ua) && !("MSStream" in window));

    // Já a correr como aplicação instalada: convidar a instalar outra vez seria
    // pedir a alguém que já entrou que abra a porta.
    const instalada =
      window.matchMedia("(display-mode: standalone)").matches ||
      ("standalone" in window.navigator &&
        Boolean(window.navigator.standalone));

    if (instalada) definirEstado("fechada");
    else if (window.sessionStorage.getItem(CHAVE) === "sim")
      definirEstado("fechada");

    // A folha entra a subir, e só depois de o ecrã estar pintado — se subir no
    // mesmo instante em que a página aparece, o movimento perde-se.
    const t = window.setTimeout(() => definirPronta(true), 60);

    function guardar(e: Event) {
      // Sem o preventDefault o Android mostra a sua própria barrinha em baixo e
      // depois esquece-a. Guardando o aviso, é este botão que manda.
      e.preventDefault();
      aviso.current = e as Aviso;
    }

    function instalou() {
      // Foi ao fim: a folha sai e o formulário fica, sem navegar. É a frase
      // dele — "a tela de cima desaparece e o cadastro continua visível".
      definirEstado("instalado");
      window.sessionStorage.setItem(CHAVE, "sim");
    }

    window.addEventListener("beforeinstallprompt", guardar);
    window.addEventListener("appinstalled", instalou);
    return () => {
      window.clearTimeout(t);
      window.removeEventListener("beforeinstallprompt", guardar);
      window.removeEventListener("appinstalled", instalou);
    };
  }, []);

  const fechar = useCallback(() => {
    definirEstado("fechada");
    window.sessionStorage.setItem(CHAVE, "sim");
  }, []);

  async function baixar() {
    const guardado = aviso.current;
    if (!guardado) {
      // Nada para abrir neste telemóvel. Em vez de não acontecer nada, mostro
      // o caminho que existe mesmo.
      definirEstado("instrucoes");
      return;
    }
    definirAbrindo(true);
    try {
      await guardado.prompt();
      const escolha = await guardado.userChoice.catch(() => null);
      // O aviso só serve uma vez. Se ele recusou, deixo a folha aberta: pode
      // querer tentar outra vez, e aí já não há caixa — passa às instruções.
      aviso.current = null;
      if (escolha?.outcome === "accepted") {
        // O `appinstalled` costuma chegar sozinho, mas em alguns Android chega
        // tarde ou não chega. Não deixo a folha presa à espera dele.
        definirEstado("instalado");
        window.sessionStorage.setItem(CHAVE, "sim");
      }
    } finally {
      definirAbrindo(false);
    }
  }

  if (estado === "fechada") return null;

  if (estado === "instalado") {
    return (
      <p className="aviso-instalado" role="status">
        <span aria-hidden>✓</span> Aplicativo instalado. Agora é só entrar.
      </p>
    );
  }

  return (
    <div
      className={`folha-instalar ${pronta ? "aberta" : ""}`}
      role="dialog"
      aria-modal="false"
    >
      {/* O escurecido não fecha a folha ao toque: nesta tela ela é o passo, não
          um anúncio, e fechar sem querer deixava a pessoa sem perceber o que
          desapareceu. Fecha-se pelo texto verde, que diz o que faz. */}
      <div className="folha-sombra" aria-hidden />

      <section className="folha-corpo">
        <DecoracaoPastel variante="folha" />
        <span className="folha-pega" aria-hidden />

        <div className="folha-conteudo">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            className="folha-marca"
            src="/logo-santtify.png"
            alt="Santtify"
          />

          {estado === "convite" ? (
            <>
              <h2>
                BAIXE O APLICATIVO <span className="realce">GRÁTIS</span>
              </h2>
              <p>Baixe o aplicativo e depois faça seu cadastro gratuito.</p>

              <button
                type="button"
                className="botao-baixar"
                onClick={baixar}
                disabled={abrindo}
              >
                <span className="seta" aria-hidden>
                  <svg
                    viewBox="0 0 24 24"
                    width="20"
                    height="20"
                    fill="currentColor"
                  >
                    <path d="M12 3a1 1 0 0 1 1 1v9.6l3.3-3.3a1 1 0 1 1 1.4 1.4l-5 5a1 1 0 0 1-1.4 0l-5-5a1 1 0 1 1 1.4-1.4l3.3 3.3V4a1 1 0 0 1 1-1Z" />
                    <path d="M4 18a1 1 0 0 1 1 1v1h14v-1a1 1 0 1 1 2 0v1.5a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 20.5V19a1 1 0 0 1 1-1Z" />
                  </svg>
                </span>
                {abrindo ? "ABRINDO..." : "BAIXAR APLICATIVO"}
              </button>
            </>
          ) : (
            <>
              <h2>COMO INSTALAR NESTE TELEFONE</h2>
              {ehIphone ? (
                <ol className="folha-passos">
                  <li>
                    Toque em <strong>Compartilhar</strong>{" "}
                    <span aria-hidden>⬆</span>, na barra de baixo do Safari.
                  </li>
                  <li>
                    Deslize e toque em{" "}
                    <strong>Adicionar à Tela de Início</strong>.
                  </li>
                  <li>
                    Toque em <strong>Adicionar</strong>, no canto superior
                    direito.
                  </li>
                </ol>
              ) : (
                <ol className="folha-passos">
                  <li>
                    Toque nos <strong>três pontinhos</strong>{" "}
                    <span aria-hidden>⋮</span>, no canto de cima do navegador.
                  </li>
                  <li>
                    Toque em <strong>Instalar aplicativo</strong> ou{" "}
                    <strong>Adicionar à tela inicial</strong>.
                  </li>
                  <li>
                    Confirme em <strong>Instalar</strong>.
                  </li>
                </ol>
              )}
              <p className="folha-nota">
                {ehIphone
                  ? "O iPhone não deixa nenhum site instalar-se sozinho. Este caminho é da Apple, não nosso."
                  : "Este navegador ainda não ofereceu a instalação automática. Por aqui funciona sempre."}
              </p>
            </>
          )}

          <button type="button" className="folha-sair" onClick={fechar}>
            CONTINUAR EXPLORANDO
          </button>
        </div>
      </section>
    </div>
  );
}
