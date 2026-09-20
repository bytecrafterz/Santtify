# O ouvinte das músicas. Ver deploy/transcritor/transcritor.py.
#
# Imagem à parte de propósito: traz um modelo de reconhecimento de fala e as
# bibliotecas que o correm, e isso são centenas de megabytes que não têm nada
# que fazer dentro da API. Assim, publicar o site não reconstrói isto, e este
# processo pode ser parado — ou mudado para um servidor com mais força — sem
# tocar no que está no ar.
FROM python:3.12-slim

# faster-whisper descodifica o áudio com PyAV, que já traz o ffmpeg dentro: não
# é preciso instalar nada do sistema. Uma imagem sem compilador nem ferramentas
# é uma imagem com menos maneiras de correr mal.
#
# `requests` vai explícito porque o faster-whisper 1.1.1 importa-o em
# `utils.py` e NÃO o declara: vinha de boleia no huggingface_hub, que entretanto
# passou a usar httpx. Sem ele a imagem instala-se, arranca, fala com a API e só
# rebenta quando vai buscar o modelo — ou seja, na primeira música a sério.
RUN pip install --no-cache-dir "faster-whisper==1.1.1" "requests>=2.32"

# Os modelos descarregam-se uma vez e ficam num volume. Sem isto, cada reinício
# voltava a puxar 1,5 GB da internet antes de ouvir a primeira nota.
ENV HF_HOME=/modelos \
    PYTHONUNBUFFERED=1

# Não corre como root. Nada aqui precisa disso.
RUN useradd --create-home --uid 10001 ouvinte && mkdir -p /modelos && chown ouvinte /modelos
USER ouvinte

COPY deploy/transcritor/transcritor.py /app/transcritor.py
WORKDIR /app
CMD ["python", "transcritor.py"]
