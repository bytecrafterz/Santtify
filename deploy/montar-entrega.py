#!/usr/bin/env python3
"""Monta a árvore de entrega: só o código, histórico novo, sem nada interno.

    python3 deploy/montar-entrega.py [destino]

Prepara, NÃO entrega. Deixa uma pasta pronta a dar a outra pessoa e sai com
código diferente de zero se alguma coisa interna tiver escapado.

PORQUÊ ISTO EXISTE. O repositório de trabalho não se pode dar a ninguém: o
histórico do git guarda o valor do contrato, a negociação inteira, as notas
privadas sobre o cliente e, no primeiro commit, o telemóvel dele. Apagar os
ficheiros hoje não os tira do histórico. O que se entrega é uma árvore nova.

E ESTE FICHEIRO VIVE NO REPOSITÓRIO, e não numa pasta temporária. A primeira
versão foi escrita no scratchpad, a pasta foi limpa, e a entrega que eu tinha
dado por pronta deixou de existir. O que interessa fica versionado.
"""
import io
import os
import shutil
import subprocess
import sys

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DESTINO = sys.argv[1] if len(sys.argv) > 1 else os.path.join(RAIZ, '..', 'santtify-entrega')
DESTINO = os.path.abspath(DESTINO)


def fica_de_fora(f):
    """O que não vai, e a razão de cada linha."""
    if f.startswith('docs/contexto/'):
        return 'negociação, proposta e perfil do cliente'
    if f.startswith('docs/mensagens/'):
        return 'cada mensagem enviada, com a intenção por trás'
    if f.startswith('docs/PROGRESSO'):
        return 'notas internas sobre a relação com o cliente'
    if f.startswith('docs/ESTADO-'):
        return 'notas internas de estado diário'
    if f.startswith('docs/TERMO-DE-GARANTIA') or f.startswith('docs/Termo-de-Garantia'):
        return 'termo de garantia; é entre mim e o cliente, não é código'
    # Os áudios que ele me mandou durante o desenvolvimento, largados na raiz.
    # São 25 MB de conteúdo DELE, que já está publicado no servidor dele, e
    # nenhuma linha de código lhes toca. O que se entrega é o código.
    if '/' not in f and f.lower().endswith(('.mp3', '.wav', '.m4a')):
        return 'áudios do cliente na raiz; conteúdo dele, não código'
    if f == '.env.bak':
        return 'cópia de um .env; não pertence a um repositório'
    if f == 'deploy/montar-entrega.py':
        return 'este script; nomeia o que fica de fora'
    return None


seguidos = subprocess.run(['git', 'ls-files'], cwd=RAIZ,
                          capture_output=True, text=True).stdout.split('\n')

shutil.rmtree(DESTINO, ignore_errors=True)
os.makedirs(DESTINO, exist_ok=True)

dentro, excluidos = 0, {}
for f in seguidos:
    if not f:
        continue
    razao = fica_de_fora(f)
    if razao:
        excluidos[razao] = excluidos.get(razao, 0) + 1
        continue
    os.makedirs(os.path.join(DESTINO, os.path.dirname(f)), exist_ok=True)
    shutil.copy2(os.path.join(RAIZ, f), os.path.join(DESTINO, f))
    dentro += 1

# O README aponta para documentos que não vão; passa a apontar para os que vão.
p = os.path.join(DESTINO, 'README.md')
s = io.open(p, encoding='utf-8').read()
i, j = s.index('## Documentação'), s.index('## Estrutura')
s = s[:i] + """## Documentação

| Documento | O que é |
|---|---|
| [docs/ENTREGA.md](docs/ENTREGA.md) | **Comece por aqui.** Stack, como rodar, como publicar, e o que já existe de cartões e PDF |
| [docs/ARQUITETURA.md](docs/ARQUITETURA.md) | Decisões técnicas, modelo de dados, fluxo de propagação |
| [deploy/percursos/README.md](deploy/percursos/README.md) | As verificações de interface, e porque existem |

""" + s[j:]
s = s.replace('Cliente: Rossandro Caxito · Contratado via Workana · Fase 1 em desenvolvimento.\n', '')
io.open(p, 'w', encoding='utf-8').write(s)

subprocess.run(['git', 'init', '-q'], cwd=DESTINO, check=True)
subprocess.run(['git', 'add', '-A'], cwd=DESTINO, check=True)
subprocess.run(['git', '-c', 'user.name=Bruno Baruchi', '-c', 'user.email=sonwong364@gmail.com',
                'commit', '-q', '-m',
                'Santtify: plataforma Produto Vivo\n\nCodigo-fonte da plataforma. Comece por docs/ENTREGA.md.'],
               cwd=DESTINO, check=True)

print(f'{dentro} ficheiros em {DESTINO}')
print('ficaram de fora:')
for razao, n in excluidos.items():
    print(f'  {n:3d}  {razao}')

# A conferência. `-I` salta ficheiros binários: dois MP3 do projeto têm os bytes
# "USD" lá dentro por acaso, e sem isso isto acusa a cada corrida — o que ensina
# a ignorá-la.
mau = 0
for termo in ['USD', 'Workana', 'Bruno.Dev', 'PROGRESSO.md', 'mudou de direção']:
    achou = subprocess.run(['grep', '-rlI', termo, '.', '--exclude-dir=.git'],
                           cwd=DESTINO, capture_output=True, text=True).stdout.strip()
    if achou:
        mau += 1
        print(f'  ESCAPOU "{termo}": {achou}')
tel = subprocess.run(['grep', '-rlIE', r'\+351[ -]?[0-9]{3}[ -]?[0-9]{3}', '.', '--exclude-dir=.git'],
                     cwd=DESTINO, capture_output=True, text=True).stdout.strip()
if tel:
    mau += 1
    print(f'  ESCAPOU telefone: {tel}')

print('LIMPO' if not mau else 'REVER')
sys.exit(1 if mau else 0)
