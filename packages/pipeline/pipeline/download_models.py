import hashlib
import os
import shutil
import sys
import tempfile
import urllib.request
import zipfile
from pathlib import Path

ARCHIVE_NAME = "buffalo_l.zip"
ARCHIVE_URL = "https://github.com/deepinsight/insightface/releases/download/v0.7/buffalo_l.zip"
ARCHIVE_SHA256 = "80ffe37d8a5940d59a7384c201a2a38d4741f2f3c51eef46ebb28218a7b0ca2f"
ARCHIVE_MEMBERS = ("det_10g.onnx", "w600k_r50.onnx")

FILE_URLS = {
    "2.7_80x80_MiniFASNetV2.onnx": (
        "https://github.com/TheoOdawara/Vultra/releases/download/models-v1/2.7_80x80_MiniFASNetV2.onnx"
    ),
    "4_0_0_80x80_MiniFASNetV1SE.onnx": (
        "https://github.com/TheoOdawara/Vultra/releases/download/models-v1/4_0_0_80x80_MiniFASNetV1SE.onnx"
    ),
    "facial_expression_recognition_mobilefacenet_2022july.onnx": (
        "https://media.githubusercontent.com/media/opencv/opencv_zoo/"
        "47534e27c9851bb1128ccc0102f1145e27f23f98/models/facial_expression_recognition/"
        "facial_expression_recognition_mobilefacenet_2022july.onnx"
    ),
}

MODEL_SHA256 = {
    "det_10g.onnx": "5838f7fe053675b1c7a08b633df49e7af5495cee0493c7dcf6697200b85b5b91",
    "w600k_r50.onnx": "4c06341c33c2ca1f86781dab0e829f88ad5b64be9fba56e56bc9ebdefc619e43",
    "2.7_80x80_MiniFASNetV2.onnx": "f89cdeaa53287ac3ca18dbc0f4903498898d8db8f334afd7bc9e9c1fe7c6c64d",
    "4_0_0_80x80_MiniFASNetV1SE.onnx": "ab4c068865ebcf83b8ef86b022cc0ccbe58d0c584091a0a8005af7b716d90afa",
    "facial_expression_recognition_mobilefacenet_2022july.onnx": (
        "4f61307602fc089ce20488a31d4e4614e3c9753a7d6c41578c854858b183e1a9"
    ),
}


def extract_archive_members(directory: Path, members: list[str]) -> bool:
    with tempfile.TemporaryFile(dir=directory) as archive:
        with urllib.request.urlopen(ARCHIVE_URL) as response:
            shutil.copyfileobj(response, archive)
        archive.seek(0)
        if hashlib.file_digest(archive, "sha256").hexdigest() != ARCHIVE_SHA256:
            return False
        with zipfile.ZipFile(archive) as bundle:
            for member in members:
                with bundle.open(member) as source, (directory / member).open("wb") as target:
                    shutil.copyfileobj(source, target)
    return True


def main() -> None:
    directory = Path(os.environ["PIPELINE_MODEL_DIR"])

    missing_members = [member for member in ARCHIVE_MEMBERS if not (directory / member).exists()]
    if missing_members and not extract_archive_members(directory, missing_members):
        print(f"checksum mismatch: {ARCHIVE_NAME}")
        sys.exit(1)

    for name, url in FILE_URLS.items():
        if (directory / name).exists():
            continue
        with urllib.request.urlopen(url) as response, (directory / name).open("wb") as target:
            shutil.copyfileobj(response, target)

    mismatched = []
    for name, expected in MODEL_SHA256.items():
        with (directory / name).open("rb") as model:
            if hashlib.file_digest(model, "sha256").hexdigest() != expected:
                mismatched.append(name)
    for name in mismatched:
        (directory / name).unlink()
        print(f"checksum mismatch: {name}")
    if mismatched:
        sys.exit(1)

    print(f"models ready: {directory}")
