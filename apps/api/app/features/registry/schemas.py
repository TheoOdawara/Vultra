from datetime import datetime
from typing import Annotated
from uuid import UUID

from pydantic import BaseModel, StringConstraints


class PersonCreate(BaseModel):
    external_id: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=64)]
    name: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=200)]


class PersonRead(BaseModel):
    id: UUID
    external_id: str
    name: str
    created_at: datetime
