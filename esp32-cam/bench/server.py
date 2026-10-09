import argparse
import asyncio
import itertools
import ssl
from pathlib import Path

from websockets.asyncio.server import ServerConnection, serve

frame_sequence = itertools.count(1)


async def log_frames(connection: ServerConnection) -> None:
    async for message in connection:
        if isinstance(message, str):
            continue
        is_jpeg = message.startswith(b"\xff\xd8") and message.endswith(b"\xff\xd9")
        print(
            f"frame seq={next(frame_sequence)} bytes={len(message)} valid={str(is_jpeg).lower()}",
            flush=True,
        )


async def run(certificate: Path, private_key: Path) -> None:
    tls = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
    tls.load_cert_chain(certificate, private_key)
    async with serve(log_frames, "0.0.0.0", 8443, ssl=tls) as server:
        await server.serve_forever()


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--cert", type=Path, required=True)
    parser.add_argument("--key", type=Path, required=True)
    arguments = parser.parse_args()
    asyncio.run(run(arguments.cert, arguments.key))


if __name__ == "__main__":
    main()
