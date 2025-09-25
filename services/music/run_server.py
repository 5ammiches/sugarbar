import uvicorn

if __name__ == "__main__":
    print("FastAPI running at http://0.0.0.0:8000")
    print("OpenAPI docs available at http://0.0.0.0:8000/docs")
    uvicorn.run(
        "app.main:app", host="0.0.0.0", port=8000, reload=True, log_level="debug"
    )
