from google.adk.cli.fast_api import get_fast_api_app

app = get_fast_api_app(agents_dir="agents", web=True)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
