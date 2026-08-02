#!/usr/bin/env bash
set -euo pipefail
DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$DIR"

if [[ ! -f config.yaml && -f config.example.yaml ]]; then
  cp config.example.yaml config.yaml
  echo "[cv] created config.yaml from config.example.yaml (MQTT disabled)"
fi

if [[ ! -d .venv ]]; then
  python3 -m venv .venv
  .venv/bin/pip install -U pip
  .venv/bin/pip install -r requirements.txt
fi

echo "Демо классификации (без моторов/серво)"
echo "Браузер: http://127.0.0.1:8080/"
exec .venv/bin/python demo.py "$@"
