import os

try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

import uvicorn


if __name__ == "__main__":
    uvicorn.run(
        "cairnwise.api:app",
        host=os.getenv("CAIRNWISE_HOST", "127.0.0.1"),
        port=int(os.getenv("CAIRNWISE_PORT", "8765")),
        reload=False,
    )
