from app.application import create_app
from app.core.settings import Settings

app = create_app(Settings())
