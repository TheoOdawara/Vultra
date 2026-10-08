from pathlib import Path

import pytest


@pytest.fixture(autouse=True)
def working_directory_without_env_file(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.chdir(tmp_path)
