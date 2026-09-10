"""Командная строка пакета.

    langgraph-studio-oss --target http://127.0.0.1:2024 --port 8100
    → http://127.0.0.1:8100/studio

Запускает отдельный процесс с интерфейсом и обратным прокси к Agent Server
(docs/REQUIREMENTS.md, 2.2). Основной способ — монтирование через `http.app`
в langgraph.json; эта команда нужна, когда файл править нельзя.
"""

from __future__ import annotations

import argparse
import sys

from langgraph_studio_oss.app import DEFAULT_PATH


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="langgraph-studio-oss",
        description="Studio для LangGraph Agent Server: интерфейс и прокси на одном порту",
    )
    parser.add_argument(
        "--target",
        default="http://127.0.0.1:2024",
        help="адрес Agent Server, к которому подключается интерфейс (по умолчанию %(default)s)",
    )
    parser.add_argument("--host", default="127.0.0.1", help="интерфейс слушает на этом адресе")
    parser.add_argument("--port", type=int, default=8100, help="порт интерфейса (по умолчанию %(default)s)")
    parser.add_argument("--path", default=DEFAULT_PATH, help="путь, по которому открывается Studio")
    return parser


def main(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    try:
        import uvicorn
    except ImportError:  # pragma: no cover - зависит от окружения
        print(
            "Для этого режима нужен uvicorn: pip install 'langgraph-studio-oss[proxy]'",
            file=sys.stderr,
        )
        return 1

    from langgraph_studio_oss.proxy import create_app

    app = create_app(args.target, args.path)
    url = f"http://{args.host}:{args.port}{'/' + args.path.strip('/')}/"
    print(f"Studio: {url}\nAgent Server: {args.target}")
    uvicorn.run(app, host=args.host, port=args.port, log_level="warning")
    return 0


if __name__ == "__main__":  # pragma: no cover
    raise SystemExit(main())
