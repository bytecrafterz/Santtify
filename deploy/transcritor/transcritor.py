"""
O OUVINTE: escreve a letra das músicas a partir do áudio.

Ele pediu isto a 19/09, com estas palavras: "eu publico o áudio e o sistema
reconhece o que está sendo cantado". Este processo é o que cumpre a promessa.
Fica de lado, sozinho, e nunca é chamado por ninguém — é ELE que pergunta à
API se há música nova para ouvir. A razão é simples e vale a pena escrevê-la:
ouvir uma música de cinco minutos demora seis, e um pedido HTTP que demora seis
minutos morre em qualquer proxy do mundo. Assim, a API responde sempre depressa,
e o trabalho lento acontece aqui.

O que faz, em voz humana:

    - pergunta "há música para ouvir?" a cada poucos segundos;
    - descarrega o áudio, ouve-o e vai dizendo em que ponto vai (é a
      percentagem que ele vê no painel a subir);
    - entrega o que ouviu, com o tempo de cada palavra — que é o que faz a
      palavra acender no karaokê na altura certa;
    - se correr mal, diz que correu mal, e a API volta a pô-la na fila.

Sobre o modelo: `medium`. Foi medido com as músicas dele. O `small` é três vezes
mais rápido e escrevia disparates numa voz cantada ("Antes de eu nascer" saía
"Ante deus e nasce"); o `medium` acerta. E o filtro de silêncio (VAD) vai
DESLIGADO de propósito: numa canção com instrumental, o filtro tomava a música
por silêncio e deitava fora metade da letra.

Variáveis:

    TRANSCRITOR_API       onde está a API          (http://api:3333/api)
    TRANSCRITOR_TOKEN     a chave, obrigatória
    TRANSCRITOR_MODELO    medium | small | large-v3 (medium)
    TRANSCRITOR_NUCLEOS   quantos núcleos usar      (todos)
    TRANSCRITOR_ESPERA    segundos entre perguntas  (10)
"""
import json
import os
import sys
import tempfile
import time
import urllib.error
import urllib.request

API = os.environ.get('TRANSCRITOR_API', 'http://api:3333/api').rstrip('/')
TOKEN = os.environ.get('TRANSCRITOR_TOKEN', '')
MODELO = os.environ.get('TRANSCRITOR_MODELO', 'medium')
NUCLEOS = int(os.environ.get('TRANSCRITOR_NUCLEOS', '0'))
ESPERA = float(os.environ.get('TRANSCRITOR_ESPERA', '10'))

# Sem chave não se pergunta nada a ninguém. Melhor parar agora, com uma frase
# clara, do que ficar a bater à porta da API de dez em dez segundos para sempre.
if not TOKEN:
    print('Falta TRANSCRITOR_TOKEN. Ver deploy/.env.production.exemplo.', flush=True)
    sys.exit(2)


def dizer(*partes):
    print(time.strftime('%H:%M:%S'), *partes, flush=True)


def falar_com_a_api(caminho, corpo=None, metodo='POST'):
    dados = json.dumps(corpo).encode() if corpo is not None else b''
    pedido = urllib.request.Request(
        f'{API}{caminho}',
        data=dados,
        method=metodo,
        headers={'content-type': 'application/json', 'x-transcritor-token': TOKEN},
    )
    with urllib.request.urlopen(pedido, timeout=60) as resposta:
        return json.loads(resposta.read() or b'{}')


def descarregar(url, destino):
    """
    Traz o áudio para o disco.

    O endereço que vem no pedido é o público (https://santtify.com/uploads/...)
    porque é esse que está guardado na base. Aqui dentro não vale a pena dar a
    volta pela internet e pelo certificado para ir buscar um ficheiro que está
    na máquina do lado: troca-se o princípio do endereço pelo da API interna e
    o ficheiro vem pela rede do compose. Se não for um ficheiro de uploads
    (amanhã pode estar num armazenamento externo), vai-se buscá-lo onde está.
    """
    marca = '/uploads/'
    if marca in url:
        origem = API[: -len('/api')] if API.endswith('/api') else API
        url = origem + marca + url.split(marca, 1)[1].split('?')[0]
    with urllib.request.urlopen(url, timeout=300) as resposta, open(destino, 'wb') as ficheiro:
        while True:
            pedaco = resposta.read(1 << 16)
            if not pedaco:
                break
            ficheiro.write(pedaco)
    return os.path.getsize(destino)


def carregar_modelo():
    from faster_whisper import WhisperModel

    inicio = time.time()
    dizer(f'a carregar o modelo {MODELO}…')
    modelo = WhisperModel(
        MODELO,
        device='cpu',
        # int8 num servidor sem placa gráfica: cabe na memória e a diferença na
        # letra não se nota. Sem isto, o `medium` não arranca com 4 GB.
        compute_type='int8',
        cpu_threads=NUCLEOS or (os.cpu_count() or 2),
    )
    dizer(f'modelo pronto em {time.time() - inicio:.0f}s')
    return modelo


def ouvir(modelo, ficheiro, avisar):
    """Ouve o ficheiro e devolve as tiradas, com o tempo de cada palavra."""
    segmentos, info = modelo.transcribe(
        ficheiro,
        language='pt',
        word_timestamps=True,
        vad_filter=False,
        beam_size=5,
        # Numa música o refrão repete-se, e o modelo, se olhar para o que já
        # escreveu, entra em ciclo e escreve o refrão até ao fim do ficheiro.
        condition_on_previous_text=False,
    )
    duracao = info.duration or 0
    tiradas = []
    for s in segmentos:
        tiradas.append(
            {
                'inicioMs': int(s.start * 1000),
                'fimMs': int(s.end * 1000),
                'texto': (s.text or '').strip(),
                'palavras': [
                    {
                        'texto': (p.word or '').strip(),
                        'inicioMs': int(p.start * 1000),
                        'fimMs': int(p.end * 1000),
                    }
                    for p in (s.words or [])
                    if p.word and p.word.strip()
                ],
            }
        )
        # A percentagem é o ponto do áudio onde vai, e não o número de frases:
        # ninguém sabe quantas frases a música tem antes de a ouvir toda.
        if duracao:
            avisar(min(99, int(s.end / duracao * 100)))
    return tiradas, duracao


def tratar(modelo, tarefa):
    ident = tarefa['id']
    nome = tarefa.get('nome') or ident
    dizer(f'▶ {nome} ({tarefa.get("projeto", "?")})')

    ultima = [0.0, -1]  # quando avisei, e com que percentagem

    def avisar(pct):
        agora = time.time()
        # Um aviso por cada dois por cento, e nunca mais de um por segundo: a
        # barra do painel anda suave sem transformar isto num ataque à API.
        if pct > ultima[1] + 1 and agora - ultima[0] > 1:
            ultima[0], ultima[1] = agora, pct
            try:
                falar_com_a_api(f'/interno/transcricoes/{ident}/progresso', {'progresso': pct}, 'PATCH')
            except Exception:
                pass  # perder um aviso de progresso não estraga a transcrição

    with tempfile.NamedTemporaryFile(suffix='.audio', delete=False) as tmp:
        caminho = tmp.name
    try:
        inicio = time.time()
        tamanho = descarregar(tarefa['audio'], caminho)
        dizer(f'  áudio descarregado: {tamanho / 1e6:.1f} MB')
        # Um por cento assim que o áudio chega. O modelo leva um bom bocado até
        # devolver a primeira frase, e uma barra a zero durante dois minutos
        # parece uma avaria — este primeiro sinal diz "já comecei".
        avisar(1)
        tiradas, duracao = ouvir(modelo, caminho, avisar)
        palavras = sum(len(t['palavras']) for t in tiradas)
        dizer(
            f'  ✓ {len(tiradas)} tiradas, {palavras} palavras, '
            f'{duracao:.0f}s de áudio em {time.time() - inicio:.0f}s'
        )
        falar_com_a_api(
            f'/interno/transcricoes/{ident}/pronta',
            {'tiradas': tiradas, 'segundos': int(duracao)},
        )
    except Exception as erro:  # noqa: BLE001 — qualquer falha tem de ser contada
        dizer(f'  ✗ {erro}')
        try:
            falar_com_a_api(f'/interno/transcricoes/{ident}/falhou', {'erro': str(erro)[:500]})
        except Exception as outra:  # noqa: BLE001
            dizer(f'  (e nem isso se conseguiu dizer à API: {outra})')
    finally:
        try:
            os.unlink(caminho)
        except OSError:
            pass


def principal():
    modelo = None
    calado = 0
    while True:
        try:
            tarefa = falar_com_a_api('/interno/transcricoes/proxima')
        except urllib.error.HTTPError as erro:
            # 401 é a chave errada, e insistir não a corrige. Diz-se uma vez por
            # minuto para o log não encher de linhas iguais.
            if calado % 6 == 0:
                dizer(f'a API respondeu {erro.code} — {erro.reason}')
            calado += 1
            time.sleep(ESPERA)
            continue
        except Exception as erro:  # noqa: BLE001 — a API pode estar a reiniciar
            if calado % 6 == 0:
                dizer(f'a API ainda não responde ({erro})')
            calado += 1
            time.sleep(ESPERA)
            continue

        calado = 0
        if tarefa.get('vazio'):
            time.sleep(ESPERA)
            continue

        # O modelo só se carrega quando há trabalho: assim o processo pode ficar
        # meses ligado sem música nenhuma a ocupar 1 GB de memória à toa.
        if modelo is None:
            modelo = carregar_modelo()
        tratar(modelo, tarefa)


if __name__ == '__main__':
    dizer(f'ouvinte ligado — API {API}, modelo {MODELO}')
    try:
        principal()
    except KeyboardInterrupt:
        dizer('ouvinte desligado')
