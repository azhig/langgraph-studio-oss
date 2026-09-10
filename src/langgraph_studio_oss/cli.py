"""Command-line entry point of the package.

    langgraph-studio-oss --target http://127.0.0.1:2024 --port 8100
    → http://127.0.0.1:8100/studio

Starts a separate process with the UI and a reverse proxy to the Agent Server.
The primary way is mounting via `http.app` in langgraph.json;
this command is for when that file cannot be edited.
"""

from __future__ import annotations

import argparse
import sys

from langgraph_studio_oss.app import DEFAULT_PATH
from langgraph_studio_oss.proxy import DEFAULT_TARGET, read_saved_target, state_path, write_saved_target


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="langgraph-studio-oss",
        description="Studio for LangGraph Agent Server: UI and proxy on a single port",
    )
    parser.add_argument(
        "--target",
        default=None,
        help=(
            "Agent Server address the UI connects to; if omitted, the address last "
            f"selected in the UI is used, otherwise {DEFAULT_TARGET}"
        ),
    )
    parser.add_argument("--host", default="127.0.0.1", help="address the UI listens on")
    parser.add_argument("--port", type=int, default=8100, help="UI port (default: %(default)s)")
    parser.add_argument("--path", default=DEFAULT_PATH, help="path at which Studio is served")
    return parser


def main(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    try:
        import uvicorn
    except ImportError:  # pragma: no cover - depends on the environment
        print(
            "This mode requires uvicorn: pip install 'langgraph-studio-oss[proxy]'",
            file=sys.stderr,
        )
        return 1

    from langgraph_studio_oss.proxy import create_app

    # An explicit --target overrides the saved one and becomes the saved one itself
    state_file = state_path()
    target = args.target or read_saved_target(state_file) or DEFAULT_TARGET
    if args.target:
        write_saved_target(target, state_file)
    app = create_app(target, args.path, state_file=state_file)
    url = f"http://{args.host}:{args.port}{'/' + args.path.strip('/')}/"
    print(f"Studio: {url}\nAgent Server: {target}")
    uvicorn.run(app, host=args.host, port=args.port, log_level="warning")
    return 0


if __name__ == "__main__":  # pragma: no cover
    raise SystemExit(main())
